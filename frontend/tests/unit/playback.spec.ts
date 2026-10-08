import { test, expect } from "@playwright/test";
import { clampPlaybackTime, findActiveSegment, findTranscriptMatches, initialPlaybackState, playbackReducer, sortTranscriptSegments } from "../../src/lib/playback";

const segments = [
  { id: 1, position: 0, start_seconds: 0, end_seconds: 15 },
  { id: 2, position: 1, start_seconds: 15, end_seconds: 30 },
  { id: 3, position: 2, start_seconds: 40, end_seconds: 60 },
];

test("timestamp matching uses half-open boundaries, gaps, and invalid times", () => {
  expect(findActiveSegment(segments, 0)?.id).toBe(1);
  expect(findActiveSegment(segments, 14.999)?.id).toBe(1);
  expect(findActiveSegment(segments, 15)?.id).toBe(2);
  expect(findActiveSegment(segments, 29.9)?.id).toBe(2);
  for (const time of [30, 35, 60, 100, -1, NaN, Infinity]) expect(findActiveSegment(segments, time)).toBeUndefined();
  expect(findActiveSegment(segments, 40)?.id).toBe(3);
  expect(findActiveSegment([], 0)).toBeUndefined();
});

test("chronological sorting is deterministic and does not mutate input", () => {
  const unordered = [segments[2], segments[0], segments[1]];
  expect(sortTranscriptSegments(unordered).map(segment => segment.id)).toEqual([1, 2, 3]);
  expect(unordered[0].id).toBe(3);
});

test("seeking clamps, updates the active segment, preserves pause/play, and stops at end", () => {
  let state = playbackReducer(initialPlaybackState, { type: "seek", time: 17.5, duration: 60 });
  expect(state).toEqual({ time: 17.5, playing: false });
  expect(findActiveSegment(segments, state.time)?.id).toBe(2);
  state = playbackReducer(state, { type: "play", duration: 60 });
  state = playbackReducer(state, { type: "seek", time: 45, duration: 60 });
  expect(state).toEqual({ time: 45, playing: true });
  state = playbackReducer(state, { type: "seek", time: 100, duration: 60 });
  expect(state).toEqual({ time: 60, playing: false });
  expect(playbackReducer(state, { type: "play", duration: 60 })).toEqual({ time: 0, playing: true });
  expect(clampPlaybackTime(-12, 60)).toBe(0);
  expect(clampPlaybackTime(NaN, 60)).toBe(0);
  expect(clampPlaybackTime(20, 0)).toBe(0);
});

test("ticks use elapsed deltas, paused ticks do nothing, and duration/end are respected", () => {
  let state = playbackReducer(initialPlaybackState, { type: "play", duration: 60 });
  state = playbackReducer(state, { type: "tick", delta: 1.7, duration: 60 });
  expect(state.time).toBeCloseTo(1.7);
  state = playbackReducer(state, { type: "pause" });
  expect(playbackReducer(state, { type: "tick", delta: 10, duration: 60 })).toEqual(state);
  state = playbackReducer(state, { type: "play", duration: 60 });
  expect(playbackReducer(state, { type: "tick", delta: 100, duration: 60 })).toEqual({ time: 60, playing: false });
  expect(playbackReducer({ time: 45, playing: true }, { type: "limit", duration: 30 })).toEqual({ time: 30, playing: false });
});

test("search finds every literal, case-insensitive occurrence with exact text offsets", () => {
  const text = [{ id: 1, text: "Meeting meeting C++ [fix]." }, { id: 2, text: "Another MEETING." }];
  expect(findTranscriptMatches(text, "meeting")).toEqual([
    { segmentId: 1, start: 0, end: 7, index: 0 },
    { segmentId: 1, start: 8, end: 15, index: 1 },
    { segmentId: 2, start: 8, end: 15, index: 2 },
  ]);
  for (const literal of ["C++", "[fix]", "."]) expect(findTranscriptMatches(text, literal).length).toBeGreaterThan(0);
  expect(findTranscriptMatches(text, " ")).toEqual([]);
  expect(findTranscriptMatches(text, "absent")).toEqual([]);
});
