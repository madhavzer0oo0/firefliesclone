"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/workspace/sidebar";
import { useMeetingDetail } from "@/hooks/use-meeting-detail";
import { MeetingDetailHeader } from "./detail-header";
import { MeetingDetailTabs, type MeetingDetailTab } from "./detail-tabs";
import { MeetingContextPanel } from "./context-panel";
import { DetailError, DetailSkeleton } from "./detail-states";
import { MeetingOverview } from "./overview";
import { usePlaybackClock } from "@/hooks/use-playback-clock";
import { TranscriptPanel } from "./transcript-panel";
import { MeetingMediaPlayer } from "./media-player";
import { ActionItemsPanel } from "./action-items-panel";
import { useActionItems } from "@/hooks/use-action-items";

export function MeetingDetail({ id }: { id: number }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);
  const { data, loading, error, missing, refresh, saveActionItem } = useMeetingDetail(id);
  const actions = useActionItems(id, saveActionItem);
  const refreshMeeting = () => { if (!actions.busy) refresh(); };
  const [activeTab, setActiveTab] = useState<MeetingDetailTab>("overview");
  const playback = usePlaybackClock(data?.meeting.duration_seconds ?? 0);
  return <div className="meeting-workspace meeting-detail-workspace has-meeting-player">
    <Sidebar channel="my" onChannelChange={() => router.push("/meetings")} mobileOpen={mobileOpen} onClose={closeSidebar} disabledPlaceholders />
    <div className="workspace-main" inert={mobileOpen}>
      <MeetingDetailHeader meeting={data?.meeting ?? null} loading={loading} busy={actions.busy} onMenuClick={() => setMobileOpen(true)} onRefresh={refreshMeeting} />
      <main id="main-content"><MeetingDetailTabs activeTab={activeTab} onChange={setActiveTab} /><div className={`detail-panels ${activeTab === "transcript" ? "transcript-focused" : activeTab === "actions" ? "actions-focused" : ""}`}><div className="detail-summary-panel" hidden={activeTab !== "overview"}>{loading ? <DetailSkeleton /> : error ? <DetailError missing={missing} message={error} onRetry={refreshMeeting} /> : data ? <MeetingOverview data={data} onRefresh={refreshMeeting} onOpenActions={() => setActiveTab("actions")} /> : null}</div>{error && activeTab !== "overview" ? <DetailError missing={missing} message={error} onRetry={refreshMeeting} /> : <MeetingContextPanel hidden={activeTab === "actions"}><TranscriptPanel resource={data?.transcript ?? null} loading={loading} focused={activeTab === "transcript"} playback={playback} onRefresh={refreshMeeting} /></MeetingContextPanel>}{activeTab === "actions" && !error && <ActionItemsPanel meeting={data?.meeting ?? null} resource={data?.actions ?? null} loading={loading} controller={actions} onRefresh={refreshMeeting} />}</div></main>
      <MeetingMediaPlayer playback={playback} disabled={!data || Boolean(error)} />
    </div>
  </div>;
}
