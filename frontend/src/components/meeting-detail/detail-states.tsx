import Link from "next/link";
import { ArrowLeft, FileQuestion, WifiOff } from "lucide-react";

export function DetailSkeleton() {
  return <div className="detail-skeleton" role="status" aria-label="Loading meeting overview"><span className="sr-only">Loading meeting summary, chapters, and action items…</span>{[1, 2, 3].map(index => <div key={index}><div className="skeleton detail-skeleton-title" /><div className="skeleton detail-skeleton-line" /><div className="skeleton detail-skeleton-line" /><div className="skeleton detail-skeleton-short" /></div>)}</div>;
}

export function DetailError({ missing, message, onRetry }: { missing: boolean; message: string; onRetry: () => void }) {
  const Icon = missing ? FileQuestion : WifiOff;
  return <div className="library-state detail-error" role="alert"><div className="state-icon"><Icon size={28} /></div><h2>{missing ? "Meeting not found" : "We couldn’t open this meeting"}</h2><p>{message}</p><div className="detail-error-actions"><Link href="/meetings" className="control-button"><ArrowLeft size={15} />Back to meetings</Link>{!missing && <button className="control-button" onClick={onRetry}>Try again</button>}</div></div>;
}
