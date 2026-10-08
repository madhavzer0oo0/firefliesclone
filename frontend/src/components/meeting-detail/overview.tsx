"use client";

import { CheckCircle2, ChevronDown, Circle, Copy, FileText, ListTodo, Pencil, Sparkles, Workflow } from "lucide-react";
import { toast } from "sonner";
import { discussionPoints, formatTimestamp, summaryText, type MeetingDetailData } from "@/lib/meeting-detail";
import { initials } from "@/lib/meetings";

function Point({ text }: { text: string }) {
  const colon = text.indexOf(":");
  return colon > 0 && colon < 60 ? <><strong>{text.slice(0, colon + 1)}</strong>{text.slice(colon + 1)}</> : <>{text}</>;
}

function SectionMessage({ message, error = false, onRetry }: { message: string; error?: boolean; onRetry: () => void }) {
  return <div className={`detail-section-message ${error ? "is-error" : ""}`} role={error ? "alert" : undefined}><p>{message}</p>{error && <button onClick={onRetry}>Refresh overview</button>}</div>;
}

export function MeetingOverview({ data, onRefresh, onOpenActions }: { data: MeetingDetailData; onRefresh: () => void; onOpenActions: () => void }) {
  const { meeting, summary, chapters, actions } = data;
  const points = discussionPoints(summary.data?.notes ?? "");
  async function copySummary() {
    try { await navigator.clipboard.writeText(summaryText(data)); toast.success("Meeting summary copied to clipboard."); }
    catch { toast.error("Couldn’t copy the summary. Please try again."); }
  }
  return <div className="meeting-overview" role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
    <div className="general-summary-toolbar"><div><Sparkles size={17} /><span>General Summary</span><span className="saved-summary-label">Saved notes</span></div><div><button className="icon-button" aria-label="Copy summary" onClick={copySummary} disabled={!summary.data} title="Copy summary"><Copy size={16} /></button><button className="detail-text-button" disabled title="Summary editing is coming soon"><Pencil size={14} />Edit<span className="coming-soon-label">Soon</span></button><button className="icon-button" disabled aria-label="Regenerate summary — coming soon" title="Regenerate summary is coming soon"><Workflow size={16} /></button></div></div>
    <section className="overview-section" id="summary-overview"><h2><FileText size={17} />Overview</h2>{summary.error ? <SectionMessage message={summary.error} error onRetry={onRefresh} /> : summary.data?.overview ? <p className="full-summary" data-testid="full-summary">{summary.data.overview}</p> : <SectionMessage message="No summary yet. A saved meeting summary will appear here when one is added." onRetry={onRefresh} />}</section>
    <section className="overview-section" id="discussion-points"><h2><Sparkles size={17} />Key discussion points</h2>{summary.error ? <SectionMessage message="Discussion points are unavailable until the summary loads." onRetry={onRefresh} /> : points.length ? <ul className="discussion-points">{points.map((point, index) => <li key={index}><Point text={point} /></li>)}</ul> : <SectionMessage message="No discussion points yet. Notes saved with the summary will appear here." onRetry={onRefresh} />}</section>
    <section className="overview-section" id="meeting-chapters"><div className="overview-section-heading"><h2><FileText size={17} />Meeting chapters</h2>{chapters.data && <span className="section-count">{chapters.data.length}</span>}</div>{chapters.error ? <SectionMessage message={chapters.error} error onRetry={onRefresh} /> : chapters.data?.length ? <div className="chapter-list">{chapters.data.map(chapter => <details className="chapter-item" key={chapter.id} open><summary><span className="chapter-time">{formatTimestamp(chapter.start_seconds)}</span><span className="chapter-title">{chapter.title}</span><ChevronDown size={15} /></summary><div className="chapter-description"><p>{chapter.description || "No description has been added for this chapter."}</p><span>{formatTimestamp(chapter.start_seconds)} – {formatTimestamp(chapter.end_seconds)}</span></div></details>)}</div> : <SectionMessage message="No chapters yet. Your meeting outline will appear here." onRetry={onRefresh} />}</section>
    <section className="overview-section" id="action-preview"><div className="overview-section-heading"><h2><ListTodo size={17} />Action items</h2>{actions.data && <span className="section-count">{actions.data.length}</span>}<span className="section-preview-label">Preview</span></div>{actions.error ? <SectionMessage message={actions.error} error onRetry={onRefresh} /> : actions.data?.length ? <><ul className="action-preview-list">{actions.data.slice(0, 3).map(item => {
      const assignee = meeting.participants.find(person => person.id === item.assignee_id);
      const completed = item.status === "completed";
      return <li key={item.id} className={completed ? "completed" : ""}>{completed ? <CheckCircle2 size={17} aria-label="Completed" /> : <Circle size={17} aria-label="Open" />}<div><p>{item.text}</p><div className="action-preview-meta">{assignee && <span className="action-assignee-avatar">{initials(assignee.name)}</span>}<span>{assignee?.name ?? "Unassigned"}</span>{item.due_date && <span>Due {new Date(`${item.due_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}<span className="action-status-label">{completed ? "Completed" : "Open"}</span></div></div></li>;
    })}</ul>{actions.data.length > 3 && <p className="remaining-actions">Showing 3 of {actions.data.length} saved action items.</p>}</> : <SectionMessage message="No action items yet. Follow-ups saved for this meeting will appear here." onRetry={onRefresh} />}<button className="detail-text-button manage-actions" onClick={onOpenActions}>Manage action items</button></section>
    <footer className="summary-footer"><Sparkles size={13} /><span>Meeting notes · Saved in your workspace</span></footer>
  </div>;
}
