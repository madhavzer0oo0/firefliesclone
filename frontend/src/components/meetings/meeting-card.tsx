"use client";

import Link from "next/link";
import { ChevronRight, Copy, Pencil, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { formatDuration, initials } from "@/lib/meetings";
import type { MeetingListItem } from "@/types/api";
import { formatTimestamp } from "@/lib/meeting-detail";
import { findTranscriptMatches } from "@/lib/playback";
import { HighlightedText } from "@/components/ui/highlighted-text";

const avatarColors = ["#6169c5", "#7f62b5", "#489c8a", "#c28657", "#6687b8"];

export function MeetingCard({ meeting, query = "", onEdit, onDelete }: { meeting: MeetingListItem; query?: string; onEdit: () => void; onDelete: () => void }) {
  const started = new Date(meeting.started_at);
  const date = started.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = started.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const host = meeting.participants[0];
  const people = meeting.participants.map(person => person.name).join(", ");
  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/meetings/${meeting.id}`); toast.success("Meeting link copied to clipboard."); }
    catch { toast.error("Couldn’t copy the link. Please try again."); }
  }
  return <article className="meeting-card" data-testid="meeting-card" data-meeting-id={meeting.id}>
    <Link href={`/meetings/${meeting.id}`} className="meeting-card-link" aria-label={`Open ${meeting.title}`}>
      <div className="meeting-avatar" style={{ backgroundColor: avatarColors[(host?.id ?? meeting.id) % avatarColors.length] }}>{host ? initials(host.name) : <Video size={23} />}</div>
      <div className="meeting-card-body">
        <div className="meeting-title-line"><h2>{meeting.title}</h2><ChevronRight size={15} className="title-chevron" /><Video size={15} className="meeting-source-icon" aria-label={meeting.source} />{meeting.status !== "completed" && <span className={`meeting-status ${meeting.status}`}>{meeting.status}</span>}</div>
        <div className="meeting-meta"><time dateTime={meeting.started_at}>{date} · {time}</time><span aria-hidden="true">·</span><span>{formatDuration(meeting.duration_seconds)}</span><span className="source-separator" aria-hidden="true">·</span><span className="source-label">{meeting.source}</span></div>
        <p className="meeting-preview">{meeting.preview || (meeting.status === "processing" ? "Your meeting notes are being prepared." : "No summary yet. Open this meeting to explore its transcript.")}</p>
        <div className="meeting-participants" title={people || "No participants"}><div className="participant-avatars" aria-hidden="true">{meeting.participants.slice(0, 4).map(person => <span key={person.id} style={{ backgroundColor: avatarColors[person.id % avatarColors.length] }}>{initials(person.name)}</span>)}</div><span>{meeting.participants.length ? `${meeting.participants.slice(0, 2).map(person => person.name).join(", ")}${meeting.participants.length > 2 ? ` +${meeting.participants.length - 2} more` : ""}` : "No participants"}</span><span className="sr-only">All participants: {people}</span></div>
      </div>
    </Link>
    {meeting.match && <Link className="meeting-transcript-match" aria-label={`Open transcript match in ${meeting.title}`} href={`/meetings/${meeting.id}?${new URLSearchParams({ tab: "transcript", segment: String(meeting.match.segment_id), q: query })}`}><span>{meeting.match.speaker_label} · {formatTimestamp(meeting.match.start_seconds)} · Transcript match</span><p><HighlightedText text={meeting.match.snippet} matches={findTranscriptMatches([{ id: meeting.match.segment_id, text: meeting.match.snippet }], query)} /></p></Link>}
    <div className="meeting-card-actions"><button className="icon-button" aria-label={`Edit meeting: ${meeting.title}`} onClick={onEdit} title="Edit meeting"><Pencil size={15} /></button><button className="icon-button" aria-label={`Delete meeting: ${meeting.title}`} onClick={onDelete} title="Delete meeting"><Trash2 size={15} /></button><button className="icon-button copy-meeting-link" aria-label={`Copy link to ${meeting.title}`} onClick={copyLink} title="Copy meeting link"><Copy size={16} /></button></div>
  </article>;
}
