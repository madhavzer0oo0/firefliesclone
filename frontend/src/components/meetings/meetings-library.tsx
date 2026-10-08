"use client";

import { useCallback, useState } from "react";
import { ArrowDownWideNarrow, ChevronLeft, ChevronRight, MessageCircle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Sidebar, type Channel } from "@/components/workspace/sidebar";
import { WorkspaceHeader } from "@/components/workspace/header";
import { MeetingCard } from "./meeting-card";
import { MeetingFilters } from "./filters";
import { LibraryEmpty, LibraryError, MeetingSkeletons } from "./library-states";
import { useDebouncedValue, useMeetings } from "@/hooks/use-meetings";
import { PAGE_SIZE, type LibraryFilters } from "@/lib/meetings";
import type { MeetingListItem } from "@/types/api";

function groupMeetings(items: MeetingListItem[]) {
  const groups = new Map<string, MeetingListItem[]>();
  for (const meeting of items) {
    const key = new Date(meeting.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), meeting]);
  }
  return [...groups.entries()];
}

export function MeetingsLibrary() {
  const [channel, setChannel] = useState<Channel>("my");
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);
  const [filters, setFilters] = useState<LibraryFilters>({ search: "", participant: "", dateFrom: "", dateTo: "", order: "desc", page: 0 });
  const search = useDebouncedValue(filters.search);
  const participant = useDebouncedValue(filters.participant);
  const { data, error, loading, retry } = useMeetings({ ...filters, search, participant });
  const filtered = Boolean(filters.search || filters.participant || filters.dateFrom || filters.dateTo);
  const groups = groupMeetings(data?.items ?? []);
  const change = (values: Partial<LibraryFilters>) => setFilters(current => ({ ...current, ...values, page: 0 }));
  const clear = () => change({ search: "", participant: "", dateFrom: "", dateTo: "" });
  return <div className="meeting-workspace">
    <Sidebar channel={channel} onChannelChange={value => { setChannel(value); clear(); }} mobileOpen={mobileOpen} onClose={closeSidebar} />
    <div className="workspace-main" inert={mobileOpen}>
      <WorkspaceHeader search={filters.search} onSearchChange={value => change({ search: value })} onMenuClick={() => setMobileOpen(true)} />
      <main id="main-content">
        <div className="library-toolbar">
          <div className="toolbar-left"><div className="scope-tabs" aria-label="Meeting view"><button className={channel === "my" ? "selected" : ""} aria-pressed={channel === "my"} onClick={() => setChannel("my")}>My meetings</button><button className={channel === "all" ? "selected" : ""} aria-pressed={channel === "all"} onClick={() => setChannel("all")}>All meetings</button></div><span className="toolbar-divider" /><MeetingFilters participant={filters.participant} dateFrom={filters.dateFrom} dateTo={filters.dateTo} onChange={change} /></div>
          <div className="toolbar-right"><div className="sort-control"><ArrowDownWideNarrow size={16} /><select aria-label="Sort meetings by recency" value={filters.order} onChange={event => change({ order: event.target.value as "asc" | "desc" })}><option value="desc">Newest first</option><option value="asc">Oldest first</option></select></div><button className="icon-button refresh-button" aria-label="Refresh meetings" onClick={retry} disabled={loading}><RefreshCw size={16} className={loading ? "refreshing" : ""} /></button></div>
        </div>
        <div className="library-content">
          <div className="library-heading"><div><h2>{channel === "my" ? "My Meetings" : "All Meetings"}</h2><span className="meeting-count" aria-live="polite">{loading ? "Finding your conversations…" : data ? `${data.total} ${data.total === 1 ? "meeting" : "meetings"}${filtered ? " found" : " in your workspace"}` : "Your meeting library"}</span></div><button className="feedback-button" onClick={() => toast.info("Feedback is coming soon. Thanks for helping make the workspace better!")}><MessageCircle size={15} /> Feedback</button></div>
          {filtered && <div className="active-filters"><span>Filtered by</span>{filters.search && <button onClick={() => change({ search: "" })}>Search: {filters.search}<X size={13} /></button>}{filters.participant && <button onClick={() => change({ participant: "" })}>Participant: {filters.participant}<X size={13} /></button>}{(filters.dateFrom || filters.dateTo) && <button onClick={() => change({ dateFrom: "", dateTo: "" })}>{filters.dateFrom || "Any date"} → {filters.dateTo || "Any date"}<X size={13} /></button>}<button className="clear-filters" onClick={clear}>Clear all</button></div>}
          {loading ? <MeetingSkeletons /> : error ? <LibraryError message={error} onRetry={retry} /> : !data?.items.length ? <LibraryEmpty filtered={filtered} onClear={clear} /> : <div className="meeting-groups" aria-label="Meeting results">{groups.map(([date, meetings]) => <section className="meeting-group" key={date} aria-label={`Meetings on ${date}`}><h3 className="meeting-date-heading">{date}<span>{meetings.length}</span></h3><div className="meeting-rows">{meetings.map(meeting => <MeetingCard meeting={meeting} key={meeting.id} />)}</div></section>)}</div>}
          {data && data.total > PAGE_SIZE && <nav className="library-pagination" aria-label="Meeting pagination"><span>Showing {filters.page * PAGE_SIZE + 1}–{Math.min((filters.page + 1) * PAGE_SIZE, data.total)} of {data.total}</span><div><button className="control-button" disabled={filters.page === 0} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}><ChevronLeft size={15} /> Previous</button><button className="control-button" disabled={(filters.page + 1) * PAGE_SIZE >= data.total} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Next <ChevronRight size={15} /></button></div></nav>}
          <p className="library-end-note">Every conversation, a little easier to come back to.</p>
        </div>
      </main>
    </div>
  </div>;
}
