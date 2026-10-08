"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, FileText, SlidersHorizontal, Users, X } from "lucide-react";

interface FilterValues { title: string; participant: string; dateFrom: string; dateTo: string; includeTranscript: boolean }
interface FilterProps extends FilterValues { onChange: (values: FilterValues) => void }

export function MeetingFilters({ title, participant, dateFrom, dateTo, includeTranscript, onChange }: FilterProps) {
  const values = { title, participant, dateFrom, dateTo, includeTranscript };
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const count = Number(Boolean(title)) + Number(Boolean(participant)) + Number(Boolean(dateFrom || dateTo));
  const invalidDates = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="filter-container" ref={container}>
    <button ref={button} className={`control-button ${open || count ? "selected" : ""}`} aria-expanded={open} aria-controls="meeting-filter-panel" onClick={() => setOpen(value => !value)}><SlidersHorizontal size={16} /> Filters {count > 0 && <span className="filter-count">{count}</span>}<ChevronDown size={14} /></button>
    {open && <div className="filter-panel" id="meeting-filter-panel" role="region" aria-label="Meeting filters">
      <div className="filter-panel-heading"><strong>Filter meetings</strong><button className="icon-button" aria-label="Close filters" onClick={() => { setOpen(false); button.current?.focus(); }}><X size={17} /></button></div>
      <label className="filter-field"><span><FileText size={16} /> Meeting title</span><input autoFocus placeholder="Title contains…" aria-label="Filter by title" value={title} maxLength={200} onChange={event => onChange({ ...values, title: event.target.value })} /></label>
      <label className="filter-field"><span><Users size={16} /> Participants</span><input placeholder="Search name or email" aria-label="Filter by participant" value={participant} maxLength={254} onChange={event => onChange({ ...values, participant: event.target.value })} /></label>
      <div className="filter-date-title"><CalendarDays size={16} /><span>Date range</span></div>
      <div className="date-inputs"><label>From<input type="date" aria-label="Start date" value={dateFrom} onChange={event => onChange({ ...values, dateFrom: event.target.value })} /></label><label>To<input type="date" aria-label="End date" value={dateTo} onChange={event => onChange({ ...values, dateTo: event.target.value })} /></label></div>
      {invalidDates && <p className="date-error" role="alert">End date must be on or after start date.</p>}
      <label className="transcript-scope-toggle"><input type="checkbox" checked={includeTranscript} onChange={event => onChange({ ...values, includeTranscript: event.target.checked })} />Include transcript content in search</label>
      <div className="filter-panel-footer"><button onClick={() => onChange({ title: "", participant: "", dateFrom: "", dateTo: "", includeTranscript: false })} disabled={!count && !includeTranscript}>Clear all filters</button><button className="filter-done" onClick={() => { setOpen(false); button.current?.focus(); }}>Done</button></div>
    </div>}
  </div>;
}
