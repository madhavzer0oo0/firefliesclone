import { api, ApiError } from "@/lib/api";
import type { ActionItem, Chapter, Meeting, Summary } from "@/types/api";

export interface DetailResource<T> { data: T | null; error: string | null }
export interface MeetingDetailData {
  meeting: Meeting;
  summary: DetailResource<Summary>;
  chapters: DetailResource<Chapter[]>;
  actions: DetailResource<ActionItem[]>;
}

function resource<T>(result: PromiseSettledResult<T>, label: string, optional = false): DetailResource<T> {
  if (result.status === "fulfilled") return { data: result.value, error: null };
  if (optional && result.reason instanceof ApiError && result.reason.status === 404) {
    return { data: null, error: null };
  }
  return { data: null, error: `We couldn’t load the ${label}. Refresh to try again.` };
}

export async function fetchMeetingDetail(id: number, signal: AbortSignal): Promise<MeetingDetailData> {
  const meeting = await api.getMeeting(id, signal);
  const [summary, chapters, actions] = await Promise.allSettled([
    api.getSummary(id, signal), api.getChapters(id, signal), api.listActionItems(id, undefined, signal),
  ]);
  return {
    meeting,
    summary: resource(summary, "summary", true),
    chapters: resource(chapters, "chapters"),
    actions: resource(actions, "action items"),
  };
}

/** Display the saved notes as individual points without generating new content. */
export function discussionPoints(notes: string): string[] {
  return notes.split(/\n+|(?<=[.!?])\s+(?=[A-Z])/u).map(point => point.trim()).filter(Boolean);
}

export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return `${hours ? `${hours}:${String(minutes).padStart(2, "0")}` : String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export function summaryText(data: MeetingDetailData): string {
  const { meeting, summary } = data;
  return [meeting.title, summary.data?.overview, summary.data?.notes].filter(Boolean).join("\n\n");
}
