from datetime import datetime, timedelta
from sqlalchemy import select
from .database import SessionLocal
from . import models as m
from .seed_data import PEOPLE, MEETINGS


def seed(db):
    """Populate only an empty database; never overwrite user data."""
    if db.scalar(select(m.Meeting.id).limit(1)) is not None:
        return 0
    people = []
    for name, email in PEOPLE:
        person = db.scalar(select(m.Participant).where(m.Participant.email == email))
        if person is None:
            person = m.Participant(name=name, email=email)
            db.add(person)
        people.append(person)
    db.flush()
    for data in MEETINGS:
        started_at = datetime.fromisoformat(data['date'])
        meeting = m.Meeting(title=data['title'], started_at=started_at, duration_seconds=150,
                            source=data['source'], status='completed',
                            participants=[people[index] for index in data['people']])
        db.add(meeting)
        db.flush()
        db.add(m.Summary(meeting_id=meeting.id, overview=data['overview'], notes=data['notes']))
        for position, (speaker, text) in enumerate(data['turns']):
            db.add(m.TranscriptSegment(meeting_id=meeting.id, speaker_id=people[speaker].id,
                                      position=position, start_seconds=position * 15,
                                      end_seconds=(position + 1) * 15, text=text))
        boundaries = [(0, 45), (45, 105), (105, 150)]
        for position, (title, (start, end)) in enumerate(zip(data['chapters'], boundaries)):
            db.add(m.Chapter(meeting_id=meeting.id, position=position, title=title,
                             description=f'{title} discussed in {data["title"]}.',
                             start_seconds=start, end_seconds=end))
        for assignee, text in data['tasks']:
            db.add(m.ActionItem(meeting_id=meeting.id, assignee_id=people[assignee].id,
                                text=text, status='open', due_date=(started_at + timedelta(days=3)).date()))
    db.commit()
    return len(MEETINGS)


if __name__ == '__main__':
    with SessionLocal() as db:
        print(f'Seeded {seed(db)} meetings (existing data preserved).')
