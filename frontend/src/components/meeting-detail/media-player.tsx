"use client";

import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { formatTimestamp } from "@/lib/meeting-detail";
import type { PlaybackClock } from "@/hooks/use-playback-clock";

export function MeetingMediaPlayer({ playback, disabled }: { playback: PlaybackClock; disabled: boolean }) {
  const { time, duration, playing, seek, play, pause } = playback;
  const percent = duration > 0 ? time / duration * 100 : 0;
  return <section className="meeting-player" aria-label="Meeting playback">
    <div className="player-controls"><button className="icon-button" aria-label="Rewind 10 seconds" disabled={disabled} onClick={() => seek(time - 10)}><RotateCcw size={17} /></button><button className="player-play" aria-label={playing ? "Pause playback" : "Play playback"} disabled={disabled || duration <= 0} onClick={playing ? pause : play}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button className="icon-button" aria-label="Forward 10 seconds" disabled={disabled} onClick={() => seek(time + 10)}><RotateCw size={17} /></button></div>
    <div className="player-timeline"><span className="player-elapsed" data-testid="playback-time" data-time={time}>{formatTimestamp(Math.floor(time))}</span><input className="player-seek" type="range" aria-label="Seek meeting playback" aria-valuetext={`${formatTimestamp(Math.floor(time))} of ${formatTimestamp(Math.floor(duration))}`} min={0} max={duration} step={0.1} value={time} disabled={disabled || duration <= 0} style={{ "--seek-progress": `${percent}%` } as React.CSSProperties} onChange={event => seek(Number(event.target.value))} /><span>{formatTimestamp(Math.floor(duration))}</span></div>
    <div className="player-simulation"><span className={playing ? "simulation-dot playing" : "simulation-dot"} /><div><strong>Simulated playback</strong><span>No audio recording · Transcript clock</span></div></div>
  </section>;
}
