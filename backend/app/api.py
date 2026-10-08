from datetime import datetime
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session
from .database import get_db
from . import models as m, schemas as s
from .transcript_import import ImportProblem, parse_transcript

router = APIRouter(prefix='/api/v1')
DB = Annotated[Session, Depends(get_db)]


def require_meeting(db: Session, meeting_id: int):
    meeting = db.get(m.Meeting, meeting_id)
    if meeting is None:
        raise HTTPException(404, 'Meeting not found')
    return meeting


def require_assignee(db: Session, meeting_id: int, assignee_id: int | None):
    if assignee_id is not None and db.get(m.MeetingParticipant, (meeting_id, assignee_id)) is None:
        raise HTTPException(422, 'Speaker or assignee must be a participant in this meeting')


def resolve_participants(db: Session, participants: list[s.ParticipantInput]):
    result = []
    for participant in participants:
        existing = db.scalar(select(m.Participant).where(m.Participant.email == participant.email))
        if existing is None:
            existing = m.Participant(**participant.model_dump())
            db.add(existing)
            db.flush()
        # Existing email identifies a shared person. A meeting edit does not rename them globally.
        result.append(existing)
    return result


@router.get('/meetings', response_model=s.MeetingPage)
def list_meetings(
    db: DB,
    q: str | None = Query(default=None, max_length=200),
    search_scope: Literal['all', 'library'] = 'all',
    participant: str | None = Query(default=None, max_length=254),
    status: s.MeetingStatus | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort: Literal['started_at', 'title', 'duration_seconds'] = 'started_at',
    order: Literal['asc', 'desc'] = 'desc',
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    for value in (date_from, date_to):
        if value is not None and value.tzinfo is None:
            raise HTTPException(422, 'Date filters must include a timezone')
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, 'date_from must not exceed date_to')
    from datetime import timezone
    stmt = select(m.Meeting)
    if q:
        transcript_match = select(m.TranscriptSegment.id).where(
            m.TranscriptSegment.meeting_id == m.Meeting.id,
            m.TranscriptSegment.text.icontains(q, autoescape=True),
        ).exists()
        participant_match = m.Meeting.participants.any(or_(
            m.Participant.name.icontains(q, autoescape=True),
            m.Participant.email.icontains(q, autoescape=True),
        ))
        stmt = stmt.where(or_(m.Meeting.title.icontains(q, autoescape=True),
                             participant_match if search_scope == 'library' else transcript_match))
    if participant:
        stmt = stmt.where(m.Meeting.participants.any(or_(
            m.Participant.name.icontains(participant, autoescape=True),
            m.Participant.email.icontains(participant, autoescape=True),
        )))
    if status:
        stmt = stmt.where(m.Meeting.status == status)
    if date_from:
        stmt = stmt.where(m.Meeting.started_at >= date_from.astimezone(timezone.utc))
    if date_to:
        stmt = stmt.where(m.Meeting.started_at <= date_to.astimezone(timezone.utc))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    column = getattr(m.Meeting, sort)
    if sort == 'title':
        column = func.lower(column)
    stmt = stmt.order_by(column.asc() if order == 'asc' else column.desc(), m.Meeting.id.asc())
    meetings = db.scalars(stmt.limit(limit).offset(offset)).all()
    # One bounded summary query for the page, rather than one request/query per card.
    previews = dict(db.execute(select(m.Summary.meeting_id, m.Summary.overview).where(
        m.Summary.meeting_id.in_([meeting.id for meeting in meetings])
    )).all()) if meetings else {}
    items = [s.MeetingListItem(**s.MeetingRead.model_validate(meeting).model_dump(),
                               preview=previews.get(meeting.id)) for meeting in meetings]
    return s.MeetingPage(items=items, total=total, limit=limit, offset=offset)


@router.post('/meetings', response_model=s.MeetingRead, status_code=201)
def create_meeting(payload: s.MeetingCreate, db: DB):
    meeting = m.Meeting(**payload.model_dump(exclude={'participants'}))
    meeting.participants = resolve_participants(db, payload.participants)
    db.add(meeting)
    db.commit()
    return meeting


@router.post('/meetings/import', response_model=s.MeetingImportResult, status_code=201)
def import_meeting(payload: s.MeetingImport, db: DB):
    from uuid import uuid4
    try:
        segments, parsed_summary, parsed_actions, warnings = parse_transcript(payload.transcript, payload.duration_seconds)
    except ImportProblem as error:
        raise HTTPException(422, detail=[{'loc': ['body', 'transcript', 'content'], 'msg': str(error), 'type': 'transcript_parse_error'}]) from error
    summary = payload.summary if payload.summary is not None else parsed_summary
    actions = payload.action_items if payload.action_items is not None else parsed_actions or []
    participants = list(payload.participants)
    by_label = {person.name.casefold(): person for person in participants}
    by_email = {person.email: person for person in participants}
    # Preserve labels that are not known people without inventing real email addresses.
    for segment in segments:
        key = segment.speaker.casefold()
        if key not in by_label:
            person = s.ParticipantInput(name=segment.speaker, email=f'speaker-{uuid4().hex}@transcript.invalid')
            participants.append(person)
            by_label[key] = person
            warnings.append(f'Speaker label “{segment.speaker}” is stored as an imported identity with a placeholder email.')
    if len(participants) > 100:
        raise HTTPException(422, 'Participants and imported speaker labels must total at most 100')
    assignees = []
    for action in actions:
        person = (by_label.get(action.assignee.casefold()) or by_email.get(action.assignee.lower())) if action.assignee else None
        if action.assignee and person is None:
            raise HTTPException(422, f'Action-item assignee “{action.assignee}” must match a meeting participant name or email')
        assignees.append(person)
    people = resolve_participants(db, participants)
    by_import_email = dict(zip((person.email for person in participants), people))
    meeting = m.Meeting(**payload.model_dump(exclude={'participants', 'transcript', 'summary', 'action_items'}))
    meeting.participants = people
    db.add(meeting)
    db.flush()
    db.add_all([m.TranscriptSegment(meeting_id=meeting.id, speaker_id=by_import_email[by_label[segment.speaker.casefold()].email].id,
                                   speaker_label=segment.speaker, position=index, start_seconds=segment.start_seconds,
                                   end_seconds=segment.end_seconds, text=segment.text, timing_source=segment.timing_source)
                for index, segment in enumerate(segments)])
    if summary:
        db.add(m.Summary(meeting_id=meeting.id, **summary.model_dump()))
    for action, assignee in zip(actions, assignees):
        db.add(m.ActionItem(meeting_id=meeting.id, **action.model_dump(exclude={'assignee'}),
                            assignee_id=by_import_email[assignee.email].id if assignee else None))
    db.commit()
    return s.MeetingImportResult(meeting=meeting, segment_count=len(segments), warnings=warnings)


@router.get('/meetings/{meeting_id}', response_model=s.MeetingRead)
def get_meeting(meeting_id: int, db: DB):
    return require_meeting(db, meeting_id)


@router.patch('/meetings/{meeting_id}', response_model=s.MeetingRead)
def update_meeting(meeting_id: int, payload: s.MeetingUpdate, db: DB):
    meeting = require_meeting(db, meeting_id)
    changes = payload.model_dump(exclude_unset=True, exclude={'participants'})
    duration = changes.get('duration_seconds', meeting.duration_seconds)
    latest_segment = db.scalar(select(func.max(m.TranscriptSegment.end_seconds)).where(m.TranscriptSegment.meeting_id == meeting_id)) or 0
    latest_chapter = db.scalar(select(func.max(m.Chapter.end_seconds)).where(m.Chapter.meeting_id == meeting_id)) or 0
    if duration < max(latest_segment, latest_chapter):
        raise HTTPException(422, 'Duration cannot be shorter than transcript or chapters')
    if payload.participants is not None:
        participants = resolve_participants(db, payload.participants)
        removed = {p.id for p in meeting.participants} - {p.id for p in participants}
        if removed:
            has_segments = db.scalar(select(m.TranscriptSegment.id).where(m.TranscriptSegment.meeting_id == meeting_id, m.TranscriptSegment.speaker_id.in_(removed)).limit(1))
            has_actions = db.scalar(select(m.ActionItem.id).where(m.ActionItem.meeting_id == meeting_id, m.ActionItem.assignee_id.in_(removed)).limit(1))
            if has_segments or has_actions:
                raise HTTPException(422, 'Cannot remove a participant referenced by a transcript or action item')
        meeting.participants = participants
    for field, value in changes.items():
        setattr(meeting, field, value)
    meeting.updated_at = m.utcnow()
    db.commit()
    return meeting


@router.delete('/meetings/{meeting_id}', status_code=204)
def delete_meeting(meeting_id: int, db: DB):
    require_meeting(db, meeting_id)
    db.execute(delete(m.Meeting).where(m.Meeting.id == meeting_id))
    db.commit()
    return Response(status_code=204)


def ordered_content(db: Session, model, meeting_id: int):
    return db.scalars(select(model).where(model.meeting_id == meeting_id).order_by(model.position)).all()


def validate_timeline(items, duration):
    if len({item.position for item in items}) != len(items):
        raise HTTPException(422, 'Positions must be unique')
    previous_end = 0
    for item in sorted(items, key=lambda value: value.position):
        if item.end_seconds > duration:
            raise HTTPException(422, 'Timeline exceeds meeting duration')
        if item.start_seconds < previous_end:
            raise HTTPException(422, 'Timeline must be ordered without overlapping ranges')
        previous_end = item.end_seconds


def replace_timeline(db: Session, model, meeting: m.Meeting, items):
    validate_timeline(items, meeting.duration_seconds)
    db.execute(delete(model).where(model.meeting_id == meeting.id))
    db.add_all([model(meeting_id=meeting.id, **item.model_dump()) for item in items])
    meeting.updated_at = m.utcnow()
    db.commit()
    return ordered_content(db, model, meeting.id)


@router.get('/meetings/{meeting_id}/transcript', response_model=list[s.SegmentRead])
def get_transcript(meeting_id: int, db: DB, q: str | None = Query(default=None, max_length=200)):
    require_meeting(db, meeting_id)
    stmt = select(m.TranscriptSegment).where(m.TranscriptSegment.meeting_id == meeting_id)
    if q:
        stmt = stmt.where(m.TranscriptSegment.text.icontains(q, autoescape=True))
    return db.scalars(stmt.order_by(m.TranscriptSegment.position)).all()


@router.put('/meetings/{meeting_id}/transcript', response_model=list[s.SegmentRead])
def put_transcript(meeting_id: int, payload: list[s.SegmentInput], db: DB):
    meeting = require_meeting(db, meeting_id)
    for segment in payload:
        require_assignee(db, meeting_id, segment.speaker_id)
    return replace_timeline(db, m.TranscriptSegment, meeting, payload)


@router.get('/meetings/{meeting_id}/summary', response_model=s.SummaryRead)
def get_summary(meeting_id: int, db: DB):
    require_meeting(db, meeting_id)
    summary = db.scalar(select(m.Summary).where(m.Summary.meeting_id == meeting_id))
    if summary is None:
        raise HTTPException(404, 'Summary not found')
    return summary


@router.put('/meetings/{meeting_id}/summary', response_model=s.SummaryRead)
def put_summary(meeting_id: int, payload: s.SummaryInput, db: DB):
    meeting = require_meeting(db, meeting_id)
    summary = db.scalar(select(m.Summary).where(m.Summary.meeting_id == meeting_id))
    if summary is None:
        summary = m.Summary(meeting_id=meeting_id)
        db.add(summary)
    for field, value in payload.model_dump().items():
        setattr(summary, field, value)
    meeting.updated_at = m.utcnow()
    db.commit()
    return summary


@router.get('/meetings/{meeting_id}/chapters', response_model=list[s.ChapterRead])
def get_chapters(meeting_id: int, db: DB):
    require_meeting(db, meeting_id)
    return ordered_content(db, m.Chapter, meeting_id)


@router.put('/meetings/{meeting_id}/chapters', response_model=list[s.ChapterRead])
def put_chapters(meeting_id: int, payload: list[s.ChapterInput], db: DB):
    return replace_timeline(db, m.Chapter, require_meeting(db, meeting_id), payload)


def require_action(db: Session, meeting_id: int, item_id: int):
    require_meeting(db, meeting_id)
    item = db.get(m.ActionItem, item_id)
    if item is None or item.meeting_id != meeting_id:
        raise HTTPException(404, 'Action item not found')
    return item


@router.get('/meetings/{meeting_id}/action-items', response_model=list[s.ActionRead])
def list_actions(meeting_id: int, db: DB, status: s.ActionStatus | None = None):
    require_meeting(db, meeting_id)
    stmt = select(m.ActionItem).where(m.ActionItem.meeting_id == meeting_id)
    if status:
        stmt = stmt.where(m.ActionItem.status == status)
    return db.scalars(stmt.order_by(m.ActionItem.id)).all()


@router.post('/meetings/{meeting_id}/action-items', response_model=s.ActionRead, status_code=201)
def create_action(meeting_id: int, payload: s.ActionCreate, db: DB):
    meeting = require_meeting(db, meeting_id)
    require_assignee(db, meeting_id, payload.assignee_id)
    item = m.ActionItem(meeting_id=meeting_id, **payload.model_dump())
    db.add(item)
    meeting.updated_at = m.utcnow()
    db.commit()
    return item


@router.get('/meetings/{meeting_id}/action-items/{item_id}', response_model=s.ActionRead)
def get_action(meeting_id: int, item_id: int, db: DB):
    return require_action(db, meeting_id, item_id)


@router.patch('/meetings/{meeting_id}/action-items/{item_id}', response_model=s.ActionRead)
def update_action(meeting_id: int, item_id: int, payload: s.ActionUpdate, db: DB):
    item = require_action(db, meeting_id, item_id)
    if 'assignee_id' in payload.model_fields_set:
        require_assignee(db, meeting_id, payload.assignee_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    require_meeting(db, meeting_id).updated_at = m.utcnow()
    db.commit()
    return item


@router.delete('/meetings/{meeting_id}/action-items/{item_id}', status_code=204)
def delete_action(meeting_id: int, item_id: int, db: DB):
    db.delete(require_action(db, meeting_id, item_id))
    require_meeting(db, meeting_id).updated_at = m.utcnow()
    db.commit()
    return Response(status_code=204)
