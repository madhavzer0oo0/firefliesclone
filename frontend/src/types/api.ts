/** API v1 contracts. Datetimes are ISO 8601 UTC; transcript seconds may be fractional. */
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
export interface TranscriptSearchMatch { segment_id: number; start_seconds: number; speaker_label: string; snippet: string }
export interface MeetingListItem extends Meeting { preview: string | null; match?: TranscriptSearchMatch | null }
export interface MeetingPage { items: MeetingListItem[]; total: number; limit: number; offset: number }
export interface MeetingQuery {
  q?: string;
  search_scope?: "all" | "library" | "everywhere";
  title?: string;
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
  speaker_label?: string | null;
  timing_source?: "provided" | "inferred_end" | "estimated";
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

export interface ImportedAction { text: string; assignee?: string | null; status?: ActionStatus; due_date?: string | null }
export interface MeetingImport extends MeetingCreate {
  duration_seconds: number;
  participants: ParticipantInput[];
  transcript: { format: "txt" | "vtt" | "json"; content: string; filename?: string };
  summary?: SummaryInput;
  action_items?: ImportedAction[];
}
export interface MeetingImportResult { meeting: Meeting; segment_count: number; warnings: string[] }
