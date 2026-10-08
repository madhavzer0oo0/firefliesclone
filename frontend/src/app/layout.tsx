import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Meeting workspace", description: "Fireflies clone application foundation" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
