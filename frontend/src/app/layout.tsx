import type { Metadata } from "next";
import "./globals.css";
import "./product-polish.css";
import { ToastProvider } from "@/components/workspace/toast-provider";

export const metadata: Metadata = { title: "Meeting workspace", description: "Fireflies clone application foundation" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a>{children}<ToastProvider /></body></html>;
}
