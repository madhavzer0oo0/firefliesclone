"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Native modal supplies focus trapping, background inertness, and focus restoration. */
export function Modal({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className="app-modal" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="app-modal-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={18} /></button></div>
    {children}
  </dialog>;
}
