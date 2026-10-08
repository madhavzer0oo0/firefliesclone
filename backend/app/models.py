from datetime import date, datetime, timezone
from sqlalchemy import CheckConstraint, Date, DateTime, Float, ForeignKey, ForeignKeyConstraint, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Meeting(Base):
    __tablename__ = 'meetings'
    __table_args__ = (
        CheckConstraint('duration_seconds >= 0'),
        CheckConstraint("status IN ('processing', 'completed', 'failed')"),
        Index('ix_meetings_started_id', 'started_at', 'id'),
        Index('ix_meetings_status', 'status'),
        Index('ix_meetings_title', 'title'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default='completed')
    source: Mapped[str] = mapped_column(String(100), default='manual')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    participants: Mapped[list['Participant']] = relationship(secondary='meeting_participants', lazy='selectin')


class Participant(Base):
    __tablename__ = 'participants'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)


class MeetingParticipant(Base):
    __tablename__ = 'meeting_participants'
    __table_args__ = (Index('ix_meeting_participants_participant', 'participant_id'),)
    meeting_id: Mapped[int] = mapped_column(ForeignKey('meetings.id', ondelete='CASCADE'), primary_key=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey('participants.id', ondelete='RESTRICT'), primary_key=True)


class TranscriptSegment(Base):
    __tablename__ = 'transcript_segments'
    __table_args__ = (
        CheckConstraint("timing_source IN ('provided', 'inferred_end', 'estimated')"),
        ForeignKeyConstraint(['meeting_id', 'speaker_id'], ['meeting_participants.meeting_id', 'meeting_participants.participant_id'], ondelete='CASCADE'),
        UniqueConstraint('meeting_id', 'position'),
        CheckConstraint('position >= 0'),
        CheckConstraint('start_seconds >= 0 AND end_seconds > start_seconds'),
        Index('ix_transcript_meeting_time', 'meeting_id', 'start_seconds'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey('meetings.id', ondelete='CASCADE'))
    speaker_id: Mapped[int] = mapped_column(Integer)
    position: Mapped[int] = mapped_column(Integer)
    start_seconds: Mapped[float] = mapped_column(Float)
    end_seconds: Mapped[float] = mapped_column(Float)
    speaker_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    timing_source: Mapped[str] = mapped_column(String(20), default='provided', server_default='provided')
    text: Mapped[str] = mapped_column(Text)
    speaker: Mapped[Participant] = relationship(primaryjoin='foreign(TranscriptSegment.speaker_id) == Participant.id', viewonly=True, lazy='joined')


class Summary(Base):
    __tablename__ = 'summaries'
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey('meetings.id', ondelete='CASCADE'), unique=True)
    overview: Mapped[str] = mapped_column(Text)
    notes: Mapped[str] = mapped_column(Text, default='')


class Chapter(Base):
    __tablename__ = 'chapters'
    __table_args__ = (
        UniqueConstraint('meeting_id', 'position'),
        CheckConstraint('position >= 0'),
        CheckConstraint('start_seconds >= 0 AND end_seconds > start_seconds'),
        Index('ix_chapters_meeting_time', 'meeting_id', 'start_seconds'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey('meetings.id', ondelete='CASCADE'))
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default='')
    start_seconds: Mapped[int] = mapped_column(Integer)
    end_seconds: Mapped[int] = mapped_column(Integer)


class ActionItem(Base):
    __tablename__ = 'action_items'
    __table_args__ = (
        ForeignKeyConstraint(['meeting_id', 'assignee_id'], ['meeting_participants.meeting_id', 'meeting_participants.participant_id'], ondelete='CASCADE'),
        CheckConstraint("status IN ('open', 'completed')"),
        Index('ix_action_items_meeting_status', 'meeting_id', 'status'),
        Index('ix_action_items_assignee', 'assignee_id'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey('meetings.id', ondelete='CASCADE'))
    assignee_id: Mapped[int | None] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='open')
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
