"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { fetchMeetingDetail, type MeetingDetailData } from "@/lib/meeting-detail";

type Result = { key: string; data: MeetingDetailData | null; error: string | null; missing: boolean };

export function useMeetingDetail(id: number) {
  const [result, setResult] = useState<Result | null>(null);
  const [revision, setRevision] = useState(0);
  const key = `${id}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchMeetingDetail(id, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, data, error: null, missing: false });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const missing = error instanceof ApiError && error.status === 404;
      setResult({ key, data: null, missing, error: missing ? "This meeting may have been deleted or the link is incorrect." : "We couldn’t load this meeting. Check that the meeting service is running and try again." });
    });
    return () => controller.abort();
  }, [id, key]);

  const current = result?.key === key ? result : null;
  const previousData = result?.key.startsWith(`${id}:`) ? result.data : null;
  return { data: current ? current.data : previousData, error: current?.error ?? null, missing: current?.missing ?? false, loading: !current, refresh: () => setRevision(value => value + 1) };
}
