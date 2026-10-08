from datetime import date, datetime, timezone
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Name = Annotated[str, Field(min_length=1, max_length=120)]
Title = Annotated[str, Field(min_length=1, max_length=200)]
Text = Annotated[str, Field(min_length=1, max_length=50000)]
MeetingStatus = Literal['processing', 'completed', 'failed']
ActionStatus = Literal['open', 'completed']


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra='forbid', str_strip_whitespace=True)


class ParticipantInput(Schema):
    name: Name
    email: Annotated[str, Field(min_length=3, max_length=254, pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$')]

    @field_validator('email')
    @classmethod
    def lowercase(cls, value):
        return value.lower()


class ParticipantRead(ParticipantInput):
    id: int


class MeetingCreate(Schema):
    title: Title
    started_at: datetime
    duration_seconds: int = Field(default=0, ge=0)
    status: MeetingStatus = 'completed'
    source: Annotated[str, Field(min_length=1, max_length=100)] = 'manual'
    participants: list[ParticipantInput] = Field(default_factory=list, max_length=100)

    @field_validator('started_at')
    @classmethod
    def normalize_date(cls, value):
        if value is None:
            return value
        if value.tzinfo is None:
            raise ValueError('started_at must include a timezone')
        return value.astimezone(timezone.utc)

    @field_validator('participants')
    @classmethod
    def unique_emails(cls, value):
        if value is None:
            return value
        if len({p.email for p in value}) != len(value):
            raise ValueError('Participant emails must be unique')
        return value


class MeetingUpdate(MeetingCreate):
    title: Title | None = None
    started_at: datetime | None = None
    duration_seconds: int | None = Field(default=None, ge=0)
    status: MeetingStatus | None = None
    source: Annotated[str, Field(min_length=1, max_length=100)] | None = None
    participants: list[ParticipantInput] | None = Field(default=None, max_length=100)

    @model_validator(mode='after')
    def no_explicit_null(self):
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError('Meeting fields cannot be null; omit unchanged fields')
        return self


class MeetingRead(Schema):
    id: int
    title: str
    started_at: datetime
    duration_seconds: int
    status: MeetingStatus
    source: str
    created_at: datetime
    updated_at: datetime
    participants: list[ParticipantRead]

    @field_validator('started_at', 'created_at', 'updated_at')
    @classmethod
    def utc_date(cls, value):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


class MeetingListItem(MeetingRead):
    preview: str | None = None


class MeetingPage(Schema):
    items: list[MeetingListItem]
    total: int
    limit: int
    offset: int


class SegmentInput(Schema):
    speaker_id: int = Field(gt=0)
    position: int = Field(ge=0)
    start_seconds: int = Field(ge=0)
    end_seconds: int = Field(gt=0)
    text: Text

    @model_validator(mode='after')
    def valid_range(self):
        if self.end_seconds <= self.start_seconds:
            raise ValueError('end_seconds must exceed start_seconds')
        return self


class SegmentRead(SegmentInput):
    id: int
    meeting_id: int
    speaker: ParticipantRead


class SummaryInput(Schema):
    overview: Text
    notes: Annotated[str, Field(max_length=50000)] = ''


class SummaryRead(SummaryInput):
    id: int
    meeting_id: int


class ChapterInput(Schema):
    position: int = Field(ge=0)
    title: Title
    description: Annotated[str, Field(max_length=10000)] = ''
    start_seconds: int = Field(ge=0)
    end_seconds: int = Field(gt=0)

    @model_validator(mode='after')
    def valid_range(self):
        if self.end_seconds <= self.start_seconds:
            raise ValueError('end_seconds must exceed start_seconds')
        return self


class ChapterRead(ChapterInput):
    id: int
    meeting_id: int


class ActionCreate(Schema):
    text: Text
    assignee_id: int | None = Field(default=None, gt=0)
    status: ActionStatus = 'open'
    due_date: date | None = None


class ActionUpdate(Schema):
    text: Text | None = None
    assignee_id: int | None = Field(default=None, gt=0)
    status: ActionStatus | None = None
    due_date: date | None = None

    @model_validator(mode='after')
    def no_required_null(self):
        for field in ('text', 'status'):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f'{field} cannot be null')
        return self


class ActionRead(ActionCreate):
    id: int
    meeting_id: int
