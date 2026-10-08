import { FileText, ListTodo, Sparkles } from "lucide-react";

export type MeetingDetailTab = "overview" | "transcript" | "actions";

const tabs = [
  { id: "overview", label: "Overview", icon: Sparkles, available: true },
  { id: "transcript", label: "Transcript", icon: FileText, available: false },
  { id: "actions", label: "Action Items", icon: ListTodo, available: false },
] as const;

export function MeetingDetailTabs() {
  return <div className="detail-tabs" role="tablist" aria-label="Meeting detail tabs">{tabs.map(({ id, label, icon: Icon, available }) => <button key={id} id={`tab-${id}`} role="tab" aria-selected={id === "overview"} aria-controls={available ? "panel-overview" : undefined} disabled={!available} className={id === "overview" ? "active" : ""} title={!available ? `${label} is coming soon` : undefined}><Icon size={16} />{label}{!available && <span className="coming-soon-label">Coming Soon</span>}</button>)}</div>;
}
