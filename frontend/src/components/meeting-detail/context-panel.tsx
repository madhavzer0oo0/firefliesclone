import { Bot, FileText, ListTodo, Sparkles, Video } from "lucide-react";
import { formatDuration } from "@/lib/meetings";
import type { Meeting } from "@/types/api";

export function MeetingContextPanel({ meeting }: { meeting: Meeting | null }) {
  return <aside className="detail-context-panel" aria-label="Meeting context">
    <div className="context-panel-tabs"><span><FileText size={15} />Transcript</span><span><Bot size={16} />AskFred</span><span className="coming-soon-label">Coming Soon</span></div>
    <div className="transcript-placeholder"><div className="transcript-placeholder-icon"><FileText size={27} strokeWidth={1.3} /></div><h2>Your conversation, word for word</h2><p>The interactive transcript will live here. Speaker labels, search, and playback are coming next.</p><span className="placeholder-badge">Transcript · Coming Soon</span></div>
    <nav className="overview-index" aria-label="Overview sections"><h2>On this page</h2><a href="#summary-overview"><FileText size={15} />Overview</a><a href="#discussion-points"><Sparkles size={15} />Key discussion points</a><a href="#meeting-chapters"><Video size={15} />Meeting chapters</a><a href="#action-preview"><ListTodo size={15} />Action items</a></nav>
    {meeting && <div className="context-meeting-info"><h2>Meeting details</h2><dl><div><dt>Source</dt><dd>{meeting.source}</dd></div><div><dt>Duration</dt><dd>{formatDuration(meeting.duration_seconds)}</dd></div><div><dt>Participants</dt><dd>{meeting.participants.length}</dd></div><div><dt>Status</dt><dd className="capitalize">{meeting.status}</dd></div></dl></div>}
  </aside>;
}
