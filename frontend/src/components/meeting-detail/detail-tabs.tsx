import { FileText, ListTodo, Sparkles } from "lucide-react";

export type MeetingDetailTab = "overview" | "transcript" | "actions";

const tabs = [
  { id: "overview", label: "Overview", icon: Sparkles, available: true },
  { id: "transcript", label: "Transcript", icon: FileText, available: true },
  { id: "actions", label: "Action Items", icon: ListTodo, available: true },
] as const;

export function MeetingDetailTabs({ activeTab, onChange }: { activeTab: MeetingDetailTab; onChange: (tab: MeetingDetailTab) => void }) {
  return <div className="detail-tabs" role="tablist" aria-label="Meeting detail tabs">{tabs.map(({ id, label, icon: Icon, available }) => <button key={id} id={`tab-${id}`} role="tab" tabIndex={activeTab === id ? 0 : -1} aria-selected={activeTab === id} aria-controls={available ? `panel-${id}` : undefined} disabled={!available} className={activeTab === id ? "active" : ""} title={!available ? `${label} is coming soon` : undefined} onClick={() => onChange(id)} onKeyDown={event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(tab => tab.id === id);
    const next = event.key === "Home" ? "overview" : event.key === "End" ? "actions" : tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].id;
    onChange(next); document.getElementById(`tab-${next}`)?.focus();
  }}><Icon size={16} />{label}{!available && <span className="coming-soon-label">Coming Soon</span>}</button>)}</div>;
}
