"use client";

import { useEffect, useRef } from "react";
import { Bell, Menu, Search, Settings, X } from "lucide-react";
import { toast } from "sonner";

interface HeaderProps { search: string; onSearchChange: (value: string) => void; onMenuClick: () => void }

export function WorkspaceHeader({ search, onSearchChange, onMenuClick }: HeaderProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); } };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  return <header className="workspace-header">
    <div className="header-title"><button className="icon-button menu-toggle" aria-label="Open navigation" onClick={onMenuClick}><Menu size={21} /></button><h1>Meetings</h1></div>
    <div className="global-search"><Search size={17} /><input ref={input} type="search" aria-label="Search meetings by title or participant" placeholder="Search by title or participant" value={search} maxLength={200} onChange={event => onSearchChange(event.target.value)} />{search ? <button aria-label="Clear search" className="search-clear" onClick={() => onSearchChange("")}><X size={15} /></button> : <kbd>Ctrl + K</kbd>}</div>
    <div className="header-actions"><button className="icon-button notifications-button" aria-label="Notifications" onClick={() => toast.info("You’re all caught up. Notifications are coming soon.")}><Bell size={19} /></button><button className="icon-button" aria-label="Workspace settings" onClick={() => toast.info("Workspace settings are coming soon.")}><Settings size={19} /></button><button className="profile-avatar" aria-label="Demo user profile" title="Demo user" onClick={() => toast.info("You’re using the default demo workspace.")}>DU</button></div>
  </header>;
}
