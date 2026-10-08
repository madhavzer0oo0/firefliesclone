/** API v1 contracts. Datetimes are ISO 8601 UTC; timestamps are integer seconds. */
export type MeetingStatus = "processing" | "completed" | "failed";
export type ActionStatus = "open" | "completed";

export interface ParticipantInput { name: string; email: string }
export interface Participant extends ParticipantInput { id: number }

export interface MeetingCreate {
  title: string;
  started_at: string;
  duration_seconds?: number;
  status?: MeetingStatus;
  source?: string;
  participants?: ParticipantInput[];
}
export type MeetingUpdate = Partial<MeetingCreate>;
export interface Meeting {
  id: number;
  title: string;
  started_at: string;
  duration_seconds: number;
  status: MeetingStatus;
  source: string;
  created_at: string;
  updated_at: string;
  participants: Participant[];
}
export interface MeetingListItem extends Meeting { preview: string | null }
export interface MeetingPage { items: MeetingListItem[]; total: number; limit: number; offset: number }
export interface MeetingQuery {
  q?: string;
  search_scope?: "all" | "library";
  participant?: string;
  status?: MeetingStatus;
  date_from?: string;
  date_to?: string;
  sort?: "started_at" | "title" | "duration_seconds";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}
export interface SegmentInput {
  speaker_id: number;
  position: number;
  start_seconds: number;
  end_seconds: number;
  text: string;
}
export interface TranscriptSegment extends SegmentInput { id: number; meeting_id: number; speaker: Participant }
export interface SummaryInput { overview: string; notes?: string }
export interface Summary { id: number; meeting_id: number; overview: string; notes: string }
export interface ChapterInput {
  position: number;
  title: string;
  description?: string;
  start_seconds: number;
  end_seconds: number;
}
export interface Chapter extends ChapterInput { id: number; meeting_id: number; description: string }
export interface ActionCreate {
  text: string;
  assignee_id?: number | null;
  status?: ActionStatus;
  due_date?: string | null;
}
export type ActionUpdate = Partial<ActionCreate>;
export interface ActionItem {
  id: number;
  meeting_id: number;
  text: string;
  assignee_id: number | null;
  status: ActionStatus;
  due_date: string | null;
}
