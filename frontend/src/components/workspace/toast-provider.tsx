"use client";
import { Toaster } from "sonner";
export function ToastProvider() { return <Toaster position="top-right" offset={80} mobileOffset={{ top: 72, right: 16, left: 16 }} closeButton richColors toastOptions={{ className: "workspace-toast", style: { fontFamily: "inherit" } }} />; }
