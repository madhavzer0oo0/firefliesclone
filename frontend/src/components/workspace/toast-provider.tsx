"use client";
import { Toaster } from "sonner";
export function ToastProvider() { return <Toaster position="bottom-right" closeButton richColors toastOptions={{ style: { fontFamily: "inherit" } }} />; }
