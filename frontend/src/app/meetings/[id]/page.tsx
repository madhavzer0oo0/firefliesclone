import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingDetail } from "@/components/meeting-detail/meeting-detail";

export const metadata: Metadata = { title: "Meeting overview · Fireflies", description: "Review meeting summaries, chapters, and follow-ups." };

export default async function MeetingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const meetingId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(meetingId) || meetingId <= 0) notFound();
  const query = await searchParams;
  const segment = typeof query.segment === "string" ? Number(query.segment) : undefined;
  const targetSegmentId = segment && Number.isSafeInteger(segment) && segment > 0 ? segment : undefined;
  const initialQuery = typeof query.q === "string" ? query.q.slice(0, 200) : "";
  return <MeetingDetail id={meetingId} initialTab={query.tab === "transcript" ? "transcript" : "overview"} targetSegmentId={targetSegmentId} initialQuery={initialQuery} key={`${meetingId}:${targetSegmentId}:${initialQuery}`} />;
}
