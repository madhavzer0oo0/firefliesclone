import type { ReactNode } from "react";

export function MeetingContextPanel({ children }: { children: ReactNode }) {
  return <aside className="detail-context-panel" aria-label="Meeting context">{children}</aside>;
}
