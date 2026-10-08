"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, SlidersHorizontal, Users, X } from "lucide-react";

interface FilterProps { participant: string; dateFrom: string; dateTo: string; onChange: (values: { participant: string; dateFrom: string; dateTo: string }) => void }

export function MeetingFilters({ participant, dateFrom, dateTo, onChange }: FilterProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const count = Number(Boolean(participant)) + Number(Boolean(dateFrom || dateTo));
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
    {open && <div className="filter-panel" id="meeting-filter-panel" aria-label="Meeting filters">
      <div className="filter-panel-heading"><strong>Filter meetings</strong><button className="icon-button" aria-label="Close filters" onClick={() => { setOpen(false); button.current?.focus(); }}><X size={17} /></button></div>
      <label className="filter-field"><span><Users size={16} /> Participants</span><input autoFocus placeholder="Search name or email" aria-label="Filter by participant" value={participant} maxLength={254} onChange={event => onChange({ participant: event.target.value, dateFrom, dateTo })} /></label>
      <div className="filter-date-title"><CalendarDays size={16} /><span>Date range</span></div>
      <div className="date-inputs"><label>From<input type="date" aria-label="Start date" value={dateFrom} onChange={event => onChange({ participant, dateFrom: event.target.value, dateTo })} /></label><label>To<input type="date" aria-label="End date" value={dateTo} onChange={event => onChange({ participant, dateFrom, dateTo: event.target.value })} /></label></div>
      {invalidDates && <p className="date-error" role="alert">End date must be on or after start date.</p>}
      <div className="filter-panel-footer"><button onClick={() => onChange({ participant: "", dateFrom: "", dateTo: "" })} disabled={!count}>Clear all filters</button><button className="filter-done" onClick={() => { setOpen(false); button.current?.focus(); }}>Done</button></div>
    </div>}
  </div>;
}
