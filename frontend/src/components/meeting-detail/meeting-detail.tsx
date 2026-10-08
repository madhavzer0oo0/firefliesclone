"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { MeetingManagementDialogs } from "@/components/meetings/meeting-management";
import { useActionItems } from "@/hooks/use-action-items";

export function MeetingDetail({ id, initialTab = "overview", targetSegmentId, initialQuery = "" }: { id: number; initialTab?: MeetingDetailTab; targetSegmentId?: number; initialQuery?: string }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);
  const { data, loading, error, missing, refresh, saveActionItem, saveMeeting } = useMeetingDetail(id);
  const actions = useActionItems(id, saveActionItem);
  const refreshMeeting = () => { if (!actions.busy) refresh(); };
  const [activeTab, setActiveTab] = useState<MeetingDetailTab>(initialTab);
  const playback = usePlaybackClock(data?.meeting.duration_seconds ?? 0);
  const seek = playback.seek;
  const [management, setManagement] = useState<"edit" | "delete" | null>(null);
  const targetApplied = useRef(false);
  useEffect(() => {
    const segment = data?.transcript.data?.find(segment => segment.id === targetSegmentId);
    if (segment && !targetApplied.current) { targetApplied.current = true; seek(segment.start_seconds); }
  }, [data?.transcript.data, targetSegmentId, seek]);
  return <div className="meeting-workspace meeting-detail-workspace has-meeting-player">
    <Sidebar channel="my" onChannelChange={() => router.push("/meetings")} mobileOpen={mobileOpen} onClose={closeSidebar} disabledPlaceholders />
    <div className="workspace-main" inert={mobileOpen}>
      <MeetingDetailHeader meeting={data?.meeting ?? null} loading={loading} busy={actions.busy} onMenuClick={() => setMobileOpen(true)} onRefresh={refreshMeeting} onEdit={() => setManagement("edit")} onDelete={() => setManagement("delete")} />
      <main id="main-content"><MeetingDetailTabs activeTab={activeTab} onChange={setActiveTab} /><div className={`detail-panels ${activeTab === "transcript" ? "transcript-focused" : activeTab === "actions" ? "actions-focused" : ""}`}><div className="detail-summary-panel" hidden={activeTab !== "overview"}>{loading ? <DetailSkeleton /> : error ? <DetailError missing={missing} message={error} onRetry={refreshMeeting} /> : data ? <MeetingOverview data={data} onRefresh={refreshMeeting} onOpenActions={() => setActiveTab("actions")} /> : null}</div>{error && activeTab !== "overview" ? <DetailError missing={missing} message={error} onRetry={refreshMeeting} /> : <MeetingContextPanel hidden={activeTab === "actions"}><TranscriptPanel initialQuery={initialQuery} resource={data?.transcript ?? null} loading={loading} focused={activeTab === "transcript"} playback={playback} onRefresh={refreshMeeting} /></MeetingContextPanel>}{activeTab === "actions" && !error && <ActionItemsPanel meeting={data?.meeting ?? null} resource={data?.actions ?? null} loading={loading} controller={actions} onRefresh={refreshMeeting} />}</div></main>
      {management && data && <MeetingManagementDialogs meeting={data.meeting} mode={management} onClose={() => setManagement(null)} onSaved={saveMeeting} onDeleted={() => { playback.pause(); router.replace("/meetings"); }} />}
      <MeetingMediaPlayer playback={playback} disabled={!data || Boolean(error)} />
    </div>
  </div>;
}
