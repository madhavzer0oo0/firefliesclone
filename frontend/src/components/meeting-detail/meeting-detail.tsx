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

export function MeetingDetail({ id }: { id: number }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);
  const { data, loading, error, missing, refresh } = useMeetingDetail(id);
  const [activeTab, setActiveTab] = useState<MeetingDetailTab>("overview");
  const playback = usePlaybackClock(data?.meeting.duration_seconds ?? 0);
  return <div className="meeting-workspace meeting-detail-workspace has-meeting-player">
    <Sidebar channel="my" onChannelChange={() => router.push("/meetings")} mobileOpen={mobileOpen} onClose={closeSidebar} disabledPlaceholders />
    <div className="workspace-main" inert={mobileOpen}>
      <MeetingDetailHeader meeting={data?.meeting ?? null} loading={loading} onMenuClick={() => setMobileOpen(true)} onRefresh={refresh} />
      <main id="main-content"><MeetingDetailTabs activeTab={activeTab} onChange={setActiveTab} /><div className={`detail-panels ${activeTab === "transcript" ? "transcript-focused" : ""}`}><div className="detail-summary-panel" hidden={activeTab !== "overview"}>{loading ? <DetailSkeleton /> : error ? <DetailError missing={missing} message={error} onRetry={refresh} /> : data ? <MeetingOverview data={data} onRefresh={refresh} /> : null}</div>{error && activeTab === "transcript" ? <DetailError missing={missing} message={error} onRetry={refresh} /> : <MeetingContextPanel><TranscriptPanel resource={data?.transcript ?? null} loading={loading} focused={activeTab === "transcript"} playback={playback} onRefresh={refresh} /></MeetingContextPanel>}</div></main>
      <MeetingMediaPlayer playback={playback} disabled={!data || Boolean(error)} />
    </div>
  </div>;
}
