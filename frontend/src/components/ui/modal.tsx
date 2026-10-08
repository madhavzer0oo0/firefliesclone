"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Native modal supplies focus trapping, background inertness, and focus restoration. */
export function Modal({ title, busy, onClose, children, fallbackFocus }: { title: string; busy: boolean; onClose: () => void; children: ReactNode; fallbackFocus?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => { dialog?.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); else if (fallbackFocus) document.querySelector<HTMLElement>(fallbackFocus)?.focus({ preventScroll: true }); };
  }, [fallbackFocus]);
  return <dialog ref={ref} className="app-modal" aria-labelledby={titleId} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const controls = Array.from(ref.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]') ?? [])
      .filter(element => !element.matches(':disabled, [tabindex="-1"]') && element.getClientRects().length > 0);
    const first = controls[0], last = controls.at(-1);
    if (!first || !last) { event.preventDefault(); ref.current?.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="app-modal-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={18} /></button></div>
    {children}
  </dialog>;
}
