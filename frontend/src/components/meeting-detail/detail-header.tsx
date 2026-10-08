"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, Link2, Menu, RefreshCw, Share2, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { formatDuration, initials } from "@/lib/meetings";
import type { Meeting } from "@/types/api";
import { speakerColor } from "@/lib/playback";

interface HeaderProps { meeting: Meeting | null; loading: boolean; onMenuClick: () => void; onRefresh: () => void }

export function MeetingDetailHeader({ meeting, loading, onMenuClick, onRefresh }: HeaderProps) {
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); toast.success("Meeting link copied to clipboard."); }
    catch { toast.error("Couldn’t copy the link. Please try again."); }
  }
  return <>
    <header className="detail-topbar">
      <div className="detail-breadcrumb"><button className="icon-button" aria-label="Open navigation" onClick={onMenuClick}><Menu size={19} /></button><Link href="/meetings"><ArrowLeft size={15} /> Meetings</Link><span aria-hidden="true">/</span><span className="detail-breadcrumb-title">{meeting?.title ?? "Meeting overview"}</span></div>
      <div className="detail-top-actions"><button className="icon-button" aria-label="Refresh meeting" onClick={onRefresh} disabled={loading}><RefreshCw size={16} className={loading ? "refreshing" : ""} /></button><button className="control-button detail-share" disabled title="Sharing is coming soon"><Share2 size={14} /> Share <span className="coming-soon-label">Soon</span></button><button className="icon-button" aria-label="Copy meeting link" onClick={copyLink} disabled={!meeting}><Link2 size={17} /></button><span className="profile-avatar detail-profile" title="Default demo workspace">DU</span></div>
    </header>
    <div className="detail-meeting-heading">
      {meeting ? <>
        <div className="detail-title-row"><h1>{meeting.title}</h1><span className={`detail-status ${meeting.status}`}>{meeting.status}</span></div>
        <div className="detail-metadata"><span><CalendarDays size={14} /><time dateTime={meeting.started_at}>{new Date(meeting.started_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time></span><span><Clock3 size={14} />{formatDuration(meeting.duration_seconds)}</span><span><Video size={14} />{meeting.source}</span></div>
        <details className="detail-attendees"><summary><span className="detail-attendee-avatars" aria-hidden="true">{meeting.participants.slice(0, 4).map(person => <span key={person.id} style={{ background: speakerColor(person.id) }}>{initials(person.name)}</span>)}</span><Users size={14} /><span>{meeting.participants.length} {meeting.participants.length === 1 ? "participant" : "participants"}</span><span className="attendee-names">{meeting.participants.map(person => person.name).join(", ")}</span></summary><div className="detail-attendee-list">{meeting.participants.length ? meeting.participants.map(person => <div key={person.id}><span className="detail-person-avatar" style={{ background: speakerColor(person.id), color: "white" }}>{initials(person.name)}</span><div><strong>{person.name}</strong><span>{person.email}</span></div></div>) : <p>No participants have been added to this meeting.</p>}</div></details>
      </> : loading ? <div className="detail-heading-skeleton" aria-label="Loading meeting metadata"><div className="skeleton" /><div className="skeleton" /></div> : <h1>Meeting overview</h1>}
    </div>
  </>;
}
