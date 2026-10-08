import type { ReactNode } from "react";

export function MeetingContextPanel({ children, hidden = false }: { children: ReactNode; hidden?: boolean }) {
  return <aside className="detail-context-panel" aria-label="Meeting context" hidden={hidden}>{children}</aside>;
}
