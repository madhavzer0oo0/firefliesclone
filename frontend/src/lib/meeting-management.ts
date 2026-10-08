import { ApiError } from "@/lib/api";

export const MEETINGS_CHANGED = "meetings:changed";
export function notifyMeetingsChanged() { window.dispatchEvent(new Event(MEETINGS_CHANGED)); }

export function meetingMutationError(error: unknown, operation: "save" | "delete"): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "This meeting no longer exists. Return to the library and refresh.";
    if (typeof error.detail === "string") return error.detail;
    if (Array.isArray(error.detail)) return error.detail.map(entry => typeof entry?.msg === "string" ? entry.msg : "Check the meeting details.").join(" ");
  }
  return `Couldn’t ${operation} the meeting. Check your connection and try again.`;
}
