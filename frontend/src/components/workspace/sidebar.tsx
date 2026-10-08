"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChartNoAxesColumnIncreasing, ChevronDown, Hash, Home, Layers, ListTodo, Plus, Settings, Sparkles, Upload, Users, Video, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Channel = "my" | "all";
interface SidebarProps { channel: Channel; onChannelChange: (channel: Channel) => void; mobileOpen: boolean; onClose: () => void }

export function Sidebar({ channel, onChannelChange, mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const comingSoon = (label: string) => toast.info(`${label} is coming soon.`);
  const navigation = [{ label: "Home", icon: Home }, { label: "AskFred", icon: Bot }, { label: "Meetings", icon: Video }, { label: "Tasks", icon: ListTodo }, { label: "AI Skills", icon: Sparkles }, { label: "Analytics", icon: ChartNoAxesColumnIncreasing }, { label: "Voice Agents", icon: Bot }];
  const selectChannel = (value: Channel) => { onChannelChange(value); onClose(); };
  return <>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onClose} />}
    <aside className={cn("workspace-sidebar", mobileOpen && "is-open")} aria-label="Workspace navigation">
      <nav className="navigation-rail" aria-label="Main navigation">
        <button className="workspace-avatar" title="Northstar workspace" onClick={() => comingSoon("Workspace switching")}>N</button>
        <div className="rail-links">{navigation.map(({ label, icon: Icon }) => label === "Meetings" ? <Link key={label} href="/meetings" title={label} aria-label={label} aria-current={pathname.startsWith("/meetings") ? "page" : undefined} className={cn("rail-button", pathname.startsWith("/meetings") && "active")} onClick={onClose}><Icon size={19} strokeWidth={1.6} /></Link> : <button key={label} className={cn("rail-button", label === "Analytics" && "rail-divider")} title={label} aria-label={label} onClick={() => comingSoon(label)}><Icon size={19} strokeWidth={1.6} /></button>)}</div>
        <div className="rail-bottom"><button className="rail-button" title="Integrations" aria-label="Integrations" onClick={() => comingSoon("Integrations")}><Layers size={19} /></button><button className="rail-button" title="Settings" aria-label="Settings" onClick={() => comingSoon("Settings")}><Settings size={19} /></button></div>
      </nav>
      <div className="channel-sidebar">
        <div className="channel-heading"><span className="channel-workspace">Northstar <ChevronDown size={14} /></span><button className="icon-button mobile-close" onClick={onClose} aria-label="Close sidebar"><X size={18} /></button></div>
        <nav className="channel-links" aria-label="Meeting channels">
          <button className={cn("channel-button", channel === "my" && "active")} aria-current={channel === "my" ? "page" : undefined} onClick={() => selectChannel("my")}><Hash size={19} /> My Meetings</button>
          <button className={cn("channel-button", channel === "all" && "active")} aria-current={channel === "all" ? "page" : undefined} onClick={() => selectChannel("all")}><Users size={19} /> All Meetings</button>
          <button className="channel-button" onClick={() => comingSoon("Voice Agent Meetings")}><Bot size={19} /> Voice Agent Meetings</button>
          <button className="channel-button" onClick={() => comingSoon("Uploads")}><Upload size={19} /> Uploads</button>
        </nav>
        <div className="channel-section"><div className="channel-section-title"><span>All channels</span><button className="icon-button" aria-label="Create channel" onClick={() => comingSoon("Custom channels")}><Plus size={20} /></button></div><div className="channels-empty"><Hash size={22} strokeWidth={1.4} /><p>A little more organized.</p><span>Group your conversations into channels.</span><button onClick={() => comingSoon("Custom channels")}>Create a channel <Plus size={13} /></button></div></div>
        <div className="workspace-footer"><span className="status-dot" /><span>Personal workspace</span><span className="workspace-plan">Free</span></div>
      </div>
    </aside>
  </>;
}
