import type {
  ActionCreate, ActionItem, ActionStatus, ActionUpdate, Chapter, ChapterInput,
  Meeting, MeetingCreate, MeetingPage, MeetingQuery, MeetingUpdate,
  SegmentInput, Summary, SummaryInput, TranscriptSegment,
} from "@/types/api";

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : `API request failed (${status})`);
    this.name = "ApiError";
  }
}

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = body && typeof body === "object" && "detail" in body ? body.detail : response.statusText;
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function queryString(query: object = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });
  return params.size ? `?${params}` : "";
}
const meetingPath = (id: number) => `/meetings/${id}`;
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  listMeetings: (query?: MeetingQuery, signal?: AbortSignal) => request<MeetingPage>(`/meetings${queryString(query)}`, { signal }),
  getMeeting: (id: number) => request<Meeting>(meetingPath(id)),
  createMeeting: (data: MeetingCreate) => request<Meeting>("/meetings", json("POST", data)),
  updateMeeting: (id: number, data: MeetingUpdate) => request<Meeting>(meetingPath(id), json("PATCH", data)),
  deleteMeeting: (id: number) => request<void>(meetingPath(id), { method: "DELETE" }),
  getTranscript: (id: number, q?: string) => request<TranscriptSegment[]>(`${meetingPath(id)}/transcript${queryString({ q })}`),
  replaceTranscript: (id: number, data: SegmentInput[]) => request<TranscriptSegment[]>(`${meetingPath(id)}/transcript`, json("PUT", data)),
  getSummary: (id: number) => request<Summary>(`${meetingPath(id)}/summary`),
  saveSummary: (id: number, data: SummaryInput) => request<Summary>(`${meetingPath(id)}/summary`, json("PUT", data)),
  getChapters: (id: number) => request<Chapter[]>(`${meetingPath(id)}/chapters`),
  replaceChapters: (id: number, data: ChapterInput[]) => request<Chapter[]>(`${meetingPath(id)}/chapters`, json("PUT", data)),
  listActionItems: (id: number, status?: ActionStatus) => request<ActionItem[]>(`${meetingPath(id)}/action-items${queryString({ status })}`),
  getActionItem: (id: number, itemId: number) => request<ActionItem>(`${meetingPath(id)}/action-items/${itemId}`),
  createActionItem: (id: number, data: ActionCreate) => request<ActionItem>(`${meetingPath(id)}/action-items`, json("POST", data)),
  updateActionItem: (id: number, itemId: number, data: ActionUpdate) => request<ActionItem>(`${meetingPath(id)}/action-items/${itemId}`, json("PATCH", data)),
  deleteActionItem: (id: number, itemId: number) => request<void>(`${meetingPath(id)}/action-items/${itemId}`, { method: "DELETE" }),
};
