"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Bot, ChartNoAxesColumnIncreasing, ChevronDown, Hash, Home, Layers, ListTodo, Plus, Settings, Sparkles, Upload, Users, Video, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type Channel = "my" | "all";
interface SidebarProps { channel: Channel; onChannelChange: (channel: Channel) => void; mobileOpen: boolean; onClose: () => void; disabledPlaceholders?: boolean }

export function Sidebar({ channel, onChannelChange, mobileOpen, onClose, disabledPlaceholders = false }: SidebarProps) {
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const elements = Array.from(sidebar.current?.querySelectorAll<HTMLElement>("a, button") ?? []).filter(element => element.getClientRects().length > 0 && !element.matches(":disabled"));
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", keyboard); previous?.focus(); };
  }, [mobileOpen, onClose]);
  const pathname = usePathname();
  const comingSoon = (label: string) => toast.info(`${label} is coming soon.`);
  const navigation = [{ label: "Home", icon: Home }, { label: "AskFred", icon: Bot }, { label: "Meetings", icon: Video }, { label: "Tasks", icon: ListTodo }, { label: "AI Skills", icon: Sparkles }, { label: "Analytics", icon: ChartNoAxesColumnIncreasing }, { label: "Voice Agents", icon: Bot }];
  const selectChannel = (value: Channel) => { onChannelChange(value); onClose(); };
  return <>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onClose} />}
    <aside ref={sidebar} className={cn("workspace-sidebar", mobileOpen && "is-open")} aria-label="Workspace navigation" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined}>
      <nav className="navigation-rail" aria-label="Main navigation">
        <button className="workspace-avatar" title="Workspace switching — coming soon" disabled={disabledPlaceholders} onClick={() => comingSoon("Workspace switching")}>N</button>
        <div className="rail-links">{navigation.map(({ label, icon: Icon }) => label === "Meetings" ? <Link key={label} href="/meetings" title={label} aria-label={label} aria-current={pathname.startsWith("/meetings") ? "page" : undefined} className={cn("rail-button", pathname.startsWith("/meetings") && "active")} onClick={onClose}><Icon size={19} strokeWidth={1.6} /></Link> : <button key={label} disabled={disabledPlaceholders} className={cn("rail-button", label === "Analytics" && "rail-divider")} title={`${label} — coming soon`} aria-label={label} onClick={() => comingSoon(label)}><Icon size={19} strokeWidth={1.6} /></button>)}</div>
        <div className="rail-bottom"><button className="rail-button" disabled={disabledPlaceholders} title="Integrations — coming soon" aria-label="Integrations" onClick={() => comingSoon("Integrations")}><Layers size={19} /></button><button className="rail-button" disabled={disabledPlaceholders} title="Settings — coming soon" aria-label="Settings" onClick={() => comingSoon("Settings")}><Settings size={19} /></button></div>
      </nav>
      <div className="channel-sidebar">
        <div className="channel-heading"><span className="channel-workspace">Northstar <ChevronDown size={14} /></span><button className="icon-button mobile-close" onClick={onClose} aria-label="Close sidebar"><X size={18} /></button></div>
        <nav className="channel-links" aria-label="Meeting channels">
          <button className={cn("channel-button", pathname.startsWith("/meetings") && channel === "my" && "active")} aria-current={pathname.startsWith("/meetings") && channel === "my" ? "page" : undefined} onClick={() => selectChannel("my")}><Hash size={19} /> My Meetings</button>
          <button className={cn("channel-button", pathname.startsWith("/meetings") && channel === "all" && "active")} aria-current={pathname.startsWith("/meetings") && channel === "all" ? "page" : undefined} onClick={() => selectChannel("all")}><Users size={19} /> All Meetings</button>
          <button className="channel-button" disabled={disabledPlaceholders} title="Voice Agent Meetings — coming soon" onClick={() => comingSoon("Voice Agent Meetings")}><Bot size={19} /> Voice Agent Meetings</button>
          <button className="channel-button" disabled={disabledPlaceholders} title="Uploads — coming soon" onClick={() => comingSoon("Uploads")}><Upload size={19} /> Uploads</button>
        </nav>
        <div className="channel-section"><div className="channel-section-title"><span>All channels</span><button className="icon-button" disabled={disabledPlaceholders} title="Custom channels — coming soon" aria-label="Create channel" onClick={() => comingSoon("Custom channels")}><Plus size={20} /></button></div><div className="channels-empty"><Hash size={22} strokeWidth={1.4} /><p>A little more organized.</p><span>Group your conversations into channels.</span><button disabled={disabledPlaceholders} title="Custom channels — coming soon" onClick={() => comingSoon("Custom channels")}>Create a channel <Plus size={13} /></button></div></div>
        <div className="workspace-footer"><span className="status-dot" /><span>Personal workspace</span><span className="workspace-plan">Free</span></div>
      </div>
    </aside>
  </>;
}
