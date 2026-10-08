"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/workspace/sidebar";
import { useMeetingDetail } from "@/hooks/use-meeting-detail";
import { MeetingDetailHeader } from "./detail-header";
import { MeetingDetailTabs } from "./detail-tabs";
import { MeetingContextPanel } from "./context-panel";
import { DetailError, DetailSkeleton } from "./detail-states";
import { MeetingOverview } from "./overview";

export function MeetingDetail({ id }: { id: number }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);
  const { data, loading, error, missing, refresh } = useMeetingDetail(id);
  return <div className="meeting-workspace meeting-detail-workspace">
    <Sidebar channel="my" onChannelChange={() => router.push("/meetings")} mobileOpen={mobileOpen} onClose={closeSidebar} disabledPlaceholders />
    <div className="workspace-main" inert={mobileOpen}>
      <MeetingDetailHeader meeting={data?.meeting ?? null} loading={loading} onMenuClick={() => setMobileOpen(true)} onRefresh={refresh} />
      <main id="main-content"><MeetingDetailTabs /><div className="detail-panels"><div className="detail-summary-panel">{loading ? <DetailSkeleton /> : error ? <DetailError missing={missing} message={error} onRetry={refresh} /> : data ? <MeetingOverview data={data} onRefresh={refresh} /> : null}</div><MeetingContextPanel meeting={data?.meeting ?? null} /></div></main>
    </div>
  </div>;
}
