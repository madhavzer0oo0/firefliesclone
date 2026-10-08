"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Bot, ChevronDown, ChevronUp, FileText, Search, X } from "lucide-react";
import { findActiveSegment, findTranscriptMatches, speakerColor } from "@/lib/playback";
import { HighlightedText } from "@/components/ui/highlighted-text";
import { formatTimestamp, type DetailResource } from "@/lib/meeting-detail";
import { initials } from "@/lib/meetings";
import type { TranscriptSegment } from "@/types/api";
import type { PlaybackClock } from "@/hooks/use-playback-clock";

interface TranscriptProps { resource: DetailResource<TranscriptSegment[]> | null; loading: boolean; focused: boolean; playback: PlaybackClock; onRefresh: () => void; initialQuery?: string }

export function TranscriptPanel({ resource, loading, focused, playback, onRefresh, initialQuery = "" }: TranscriptProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [follow, setFollow] = useState(true);
  const scroll = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<number, HTMLButtonElement>());
  const segments = resource?.data;
  const matches = useMemo(() => findTranscriptMatches(segments ?? [], query), [segments, query]);
  const selected = matches.length ? Math.min(selectedIndex, matches.length - 1) : -1;
  const active = findActiveSegment(segments ?? [], playback.time);
  const activeId = active?.id;

  const scrollToElement = useCallback((element: HTMLElement) => {
    const container = scroll.current;
    if (!container) return;
    const top = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    const bottom = top + element.offsetHeight;
    if (top < container.scrollTop || bottom > container.scrollTop + container.clientHeight) {
      container.scrollTo({ top: Math.max(0, top - container.clientHeight / 3), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, []);
  const scrollToSegment = useCallback((id: number) => {
    const row = rows.current.get(id);
    if (row) scrollToElement(row);
  }, [scrollToElement]);

  useEffect(() => { if (follow && activeId !== undefined) scrollToSegment(activeId); }, [activeId, follow, focused, scrollToSegment]);
  useEffect(() => {
    if (!query.trim()) return;
    const mark = scroll.current?.querySelector<HTMLElement>('mark[data-selected="true"]');
    if (mark) scrollToElement(mark);
  }, [query, selected, segments, scrollToElement]);

  function navigateMatch(direction: number) {
    if (!matches.length) return;
    const index = (selected + direction + matches.length) % matches.length;
    setSelectedIndex(index);
    const segment = segments?.find(item => item.id === matches[index].segmentId);
    if (segment) { playback.seek(segment.start_seconds); setFollow(false); scrollToSegment(segment.id); }
  }

  return <section className="transcript-panel" id="panel-transcript" role={focused ? "tabpanel" : undefined} aria-labelledby={focused ? "tab-transcript" : undefined} aria-label={!focused ? "Meeting transcript" : undefined}>
    <div className="transcript-panel-header"><h2><FileText size={16} />Transcript</h2><span className="transcript-segment-count">{segments?.length ?? 0} segments</span><span className="transcript-askfred"><Bot size={16} />AskFred <span className="coming-soon-label">Coming Soon</span></span></div>
    <div className="transcript-search"><Search size={16} /><input type="search" aria-label="Search transcript" placeholder="Search in transcript" value={query} maxLength={200} onChange={event => { setQuery(event.target.value); setSelectedIndex(0); if (event.target.value.trim()) setFollow(false); }} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); navigateMatch(event.shiftKey ? -1 : 1); } if (event.key === "Escape") { setQuery(""); setSelectedIndex(0); } }} />{query && <button className="search-clear" aria-label="Clear transcript search" onClick={() => { setQuery(""); setSelectedIndex(0); }}><X size={14} /></button>}</div>
    {query.trim() && <div className="transcript-match-controls"><span aria-live="polite">{matches.length ? `${selected + 1} of ${matches.length} matches` : "No matches found"}</span><div><button className="icon-button" aria-label="Previous transcript match" disabled={!matches.length} onClick={() => navigateMatch(-1)}><ChevronUp size={17} /></button><button className="icon-button" aria-label="Next transcript match" disabled={!matches.length} onClick={() => navigateMatch(1)}><ChevronDown size={17} /></button></div></div>}
    {segments?.some(segment => segment.timing_source === "estimated") && <p className="transcript-import-note">Estimated timing · Plain text was spaced evenly across the duration. Unknown speaker means no label was supplied.</p>}
    {!segments?.some(segment => segment.timing_source === "estimated") && segments?.some(segment => segment.timing_source === "inferred_end") && <p className="transcript-import-note">Imported start timestamps · Segment ends inferred from the next start or meeting duration.</p>}
    {/* A focusable scroll region supports native keyboard scrolling and pauses automatic following. */}
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
    <div className="transcript-scroll" ref={scroll} role="region" aria-label="Transcript segments" tabIndex={0} onWheel={() => setFollow(false)} onTouchMove={() => setFollow(false)} onPointerDown={() => setFollow(false)} onKeyDown={event => { if (["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp"].includes(event.key)) setFollow(false); }}>
      {loading && !segments ? <div className="transcript-loading" role="status" aria-label="Loading transcript">{[1, 2, 3].map(index => <div key={index}><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>)}</div> : resource?.error ? <div className="transcript-empty" role="alert"><FileText size={26} /><h3>Transcript unavailable</h3><p>{resource.error}</p><button className="control-button" onClick={onRefresh}>Retry transcript</button></div> : !segments?.length ? <div className="transcript-empty"><FileText size={26} /><h3>No transcript yet</h3><p>Saved speaker segments will appear here when a transcript is added.</p></div> : segments.map(segment => <button key={segment.id} ref={node => { if (node) rows.current.set(segment.id, node); else rows.current.delete(segment.id); }} className={`transcript-segment ${active?.id === segment.id ? "is-active" : ""}`} data-testid="transcript-segment" data-segment-id={segment.id} data-active={active?.id === segment.id} aria-current={active?.id === segment.id ? "true" : undefined} aria-label={`Seek to ${formatTimestamp(segment.start_seconds)}, ${segment.speaker_label ?? segment.speaker.name}`} onClick={() => { playback.seek(segment.start_seconds); setFollow(true); scrollToSegment(segment.id); }}><span className="transcript-speaker-line"><span className="transcript-speaker-avatar" style={{ background: speakerColor(segment.speaker_id) }} aria-hidden="true">{initials(segment.speaker_label ?? segment.speaker.name)}</span><span className="transcript-speaker-name">{segment.speaker_label ?? segment.speaker.name}</span><span className="speaker-time-dot" aria-hidden="true">·</span><span className="transcript-timestamp">{formatTimestamp(segment.start_seconds)}</span>{active?.id === segment.id && playback.playing && <span className="segment-playing-label">Playing</span>}</span><span className="transcript-text"><HighlightedText text={segment.text} matches={matches.filter(match => match.segmentId === segment.id)} selected={selected} /></span></button>)}
    </div>
    <div className="transcript-follow-controls"><span>{follow ? "Following playback" : "Auto-scroll paused"}</span>{!follow && <button onClick={() => { setFollow(true); if (active) scrollToSegment(active.id); }}><ArrowDown size={13} />Resume follow</button>}<span>Click a line to seek</span></div>
  </section>;
}
