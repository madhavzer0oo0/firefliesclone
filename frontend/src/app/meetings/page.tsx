import type { Metadata } from "next";
import { MeetingsLibrary } from "@/components/meetings/meetings-library";

export const metadata: Metadata = { title: "Meetings · Fireflies", description: "Find and revisit your workspace conversations." };
export default function MeetingsPage() { return <MeetingsLibrary />; }
