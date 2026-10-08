import type { Metadata } from "next";
import { SettingsPage } from "@/components/workspace/settings-page";

export const metadata: Metadata = { title: "Settings · Fireflies", description: "Demo workspace settings and planned integrations." };
export default function Page() { return <SettingsPage />; }
