import type { NextConfig } from "next";

// Public variables are compiled into browser bundles; fail before a broken hosted build.
if (process.env.VERCEL === "1") {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) throw new Error("Set NEXT_PUBLIC_API_URL to the public FastAPI HTTPS URL ending in /api/v1.");
  const parsed = new URL(apiUrl);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || !/^\/api\/v1\/?$/.test(parsed.pathname) || ["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("NEXT_PUBLIC_API_URL must be a public HTTPS URL ending in /api/v1.");
  }
}

const config: NextConfig = { reactStrictMode: true };
export default config;
