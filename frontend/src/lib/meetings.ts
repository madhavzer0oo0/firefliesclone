import { api, ApiError } from "@/lib/api";
import type { MeetingPage } from "@/types/api";

export interface LibraryFilters {
  search: string;
  participant: string;
  dateFrom: string;
  dateTo: string;
  order: "asc" | "desc";
  page: number;
}
export const PAGE_SIZE = 12;

export function dateBoundary(value: string, end = false): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  // Use the viewer's local calendar dates, including daylight-saving boundaries.
  const boundary = new Date(year, month - 1, day + (end ? 1 : 0));
  if (end) boundary.setMilliseconds(-1);
  return boundary.toISOString();
}

export async function fetchLibrary(filters: LibraryFilters, signal: AbortSignal): Promise<MeetingPage> {
  return api.listMeetings({
    q: filters.search.trim() || undefined,
    search_scope: "library",
    participant: filters.participant.trim() || undefined,
    date_from: dateBoundary(filters.dateFrom),
    date_to: dateBoundary(filters.dateTo, true),
    sort: "started_at", order: filters.order,
    limit: PAGE_SIZE, offset: filters.page * PAGE_SIZE,
  }, signal);
}

export function libraryError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422) return "Check your filters and try again.";
    return "We couldn’t load your meetings. Please try again.";
  }
  return "We couldn’t connect to the meeting service. Check that the backend is running and try again.";
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  return seconds % 60 ? `${minutes} min ${seconds % 60} sec` : `${minutes} min`;
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase() || "?";
}
