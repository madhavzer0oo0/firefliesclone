"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, Bot, CalendarDays, Layers, Menu, Settings, ShieldCheck, UserRound } from "lucide-react";
import { Sidebar } from "./sidebar";

const sections = [
  { id: "account", title: "Account & profile", icon: UserRound, text: "You’re using the default demo workspace. Real authentication and account editing are not connected.", control: "Edit profile", detail: "Demo user · Personal workspace" },
  { id: "notifications", title: "Notifications", icon: Bell, text: "Notification preferences will live here. The current app shows feedback for meeting and task operations only.", control: "Manage notifications", detail: "Email and push notifications are not connected" },
  { id: "calendar", title: "Calendar", icon: CalendarDays, text: "Connect a calendar to discover upcoming meetings in a future version.", control: "Connect calendar", detail: "Google Calendar & Outlook · Coming Soon" },
  { id: "bots", title: "Meeting bots", icon: Bot, text: "Live meeting recording and speech-to-text are not enabled. Import a transcript to create a meeting today.", control: "Configure meeting bot", detail: "Manual transcript import is available" },
  { id: "integrations", title: "Integrations", icon: Layers, text: "Send meeting notes to CRM and collaboration tools in a future version. No third-party accounts are connected.", control: "Browse integrations", detail: "CRM and collaboration integrations · Coming Soon" },
  { id: "privacy", title: "Privacy & access", icon: ShieldCheck, text: "Meetings are stored in the local SQLite database. Sharing, roles, and access controls are not implemented.", control: "Manage access", detail: "Local demo · No real authentication" },
];

export function SettingsPage() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);
  return <div className="meeting-workspace settings-workspace">
    <Sidebar channel="my" onChannelChange={() => router.push("/meetings")} mobileOpen={mobileOpen} onClose={closeSidebar} disabledPlaceholders />
    <div className="workspace-main" inert={mobileOpen}>
      <header className="settings-topbar"><div><button className="icon-button menu-toggle" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><Link href="/meetings"><ArrowLeft size={15} />Meetings</Link><span aria-hidden="true">/</span><span>Settings</span></div><span className="profile-avatar detail-profile" title="Demo workspace">DU</span></header>
      <main id="main-content" className="settings-content">
        <div className="settings-heading"><span className="create-heading-icon"><Settings size={23} /></span><div><h1>Settings</h1><p>Your workspace, preferences, and connections.</p></div></div>
        <div className="settings-notice"><ShieldCheck size={19} /><p><strong>Demo workspace</strong>These settings are previews. Disabled controls are labeled Coming Soon and do not save changes.</p></div>
        <div className="settings-layout"><nav className="settings-sections" aria-label="Settings sections">{sections.map(({ id, title, icon: Icon }) => <a href={`#settings-${id}`} key={id}><Icon size={16} />{title}</a>)}</nav>
          <div className="settings-cards">{sections.map(({ id, title, icon: Icon, text, control, detail }) => <section className="settings-card" id={`settings-${id}`} key={id} aria-labelledby={`settings-title-${id}`}><div className="settings-card-heading"><span><Icon size={19} /></span><h2 id={`settings-title-${id}`}>{title}</h2><span className="coming-soon-label">Coming Soon</span></div><p>{text}</p><div className="settings-card-footer"><span>{detail}</span><button className="control-button" disabled title="Coming Soon">{control}</button></div>{id === "bots" && <Link className="settings-import-link" href="/meetings/new">Create a meeting from a transcript →</Link>}</section>)}</div>
        </div>
      </main>
    </div>
  </div>;
}
