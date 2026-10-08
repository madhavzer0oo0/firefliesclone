import type { TranscriptSegment } from "../types/api";

type TimelineSegment = Pick<TranscriptSegment, "id" | "position" | "start_seconds" | "end_seconds">;

export function sortTranscriptSegments<T extends TimelineSegment>(segments: T[]): T[] {
  return [...segments].sort((a, b) => a.start_seconds - b.start_seconds || a.position - b.position || a.id - b.id);
}

/** Half-open ranges: at a boundary the next segment is active; gaps/end have no active segment. */
export function findActiveSegment<T extends TimelineSegment>(segments: T[], time: number): T | undefined {
  if (!Number.isFinite(time) || time < 0) return undefined;
  return segments.find(segment => segment.start_seconds <= time && time < segment.end_seconds);
}

export function clampPlaybackTime(time: number, duration: number): number {
  const end = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  return Math.min(end, Math.max(0, Number.isFinite(time) ? time : 0));
}

export interface PlaybackState { time: number; playing: boolean }
export type PlaybackAction =
  | { type: "play"; duration: number }
  | { type: "pause" }
  | { type: "seek"; time: number; duration: number }
  | { type: "tick"; delta: number; duration: number }
  | { type: "limit"; duration: number };

export const initialPlaybackState: PlaybackState = { time: 0, playing: false };

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  if (action.type === "pause") return { ...state, playing: false };
  const duration = clampPlaybackTime(action.duration, action.duration);
  if (action.type === "play") {
    return duration > 0 ? { time: state.time >= duration ? 0 : state.time, playing: true } : { time: 0, playing: false };
  }
  if (action.type === "tick" && !state.playing) return state;
  const proposed = action.type === "seek" ? action.time : action.type === "tick" ? state.time + Math.max(0, Number.isFinite(action.delta) ? action.delta : 0) : state.time;
  const time = clampPlaybackTime(proposed, duration);
  return { time, playing: state.playing && time < duration };
}

export interface TranscriptMatch { segmentId: number; start: number; end: number; index: number }

export function findTranscriptMatches(segments: Pick<TranscriptSegment, "id" | "text">[], query: string): TranscriptMatch[] {
  const term = query.trim();
  if (!term) return [];
  const literal = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches: TranscriptMatch[] = [];
  for (const segment of segments) {
    for (const match of segment.text.matchAll(new RegExp(literal, "giu"))) {
      matches.push({ segmentId: segment.id, start: match.index, end: match.index + match[0].length, index: matches.length });
    }
  }
  return matches;
}

export function speakerColor(id: number): string {
  return ["#7467ba", "#60a893", "#d2a351", "#6694bf", "#ba79aa"][Math.abs(id) % 5];
}
