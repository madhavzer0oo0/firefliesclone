import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingDetail } from "@/components/meeting-detail/meeting-detail";

export const metadata: Metadata = { title: "Meeting overview · Fireflies", description: "Review meeting summaries, chapters, and follow-ups." };

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meetingId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(meetingId) || meetingId <= 0) notFound();
  return <MeetingDetail id={meetingId} key={meetingId} />;
}
