"use client";

import { useCallback, useEffect, useReducer } from "react";
import { initialPlaybackState, playbackReducer } from "@/lib/playback";

export function usePlaybackClock(duration: number) {
  const [state, dispatch] = useReducer(playbackReducer, initialPlaybackState);
  useEffect(() => { dispatch({ type: "limit", duration }); }, [duration]);

  useEffect(() => {
    if (!state.playing || duration <= 0) return;
    let previous = performance.now();
    // Monotonic elapsed time avoids timer drift. No second playback-time state/ref exists.
    const timer = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: "tick", delta: (now - previous) / 1000, duration });
      previous = now;
    }, 100);
    const visibility = () => {
      if (document.hidden) { window.clearInterval(timer); dispatch({ type: "pause" }); }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [state.playing, duration]);

  const seek = useCallback((time: number) => dispatch({ type: "seek", time, duration }), [duration]);
  const play = useCallback(() => dispatch({ type: "play", duration }), [duration]);
  const pause = useCallback(() => dispatch({ type: "pause" }), []);
  return { ...state, duration, seek, play, pause };
}

export type PlaybackClock = ReturnType<typeof usePlaybackClock>;
