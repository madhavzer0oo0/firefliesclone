import type { Metadata } from "next";
import { CreateMeeting } from "@/components/meetings/create-meeting";

export const metadata: Metadata = { title: "Create meeting · Fireflies", description: "Import a transcript into your meeting workspace." };
export default function NewMeetingPage() { return <CreateMeeting />; }
