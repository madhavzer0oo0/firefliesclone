import { CalendarDays, SearchX, WifiOff } from "lucide-react";

export function MeetingSkeletons() {
  return <div className="meeting-skeletons" role="status" aria-label="Loading meetings"><span className="sr-only">Loading meetings…</span>{Array.from({ length: 4 }, (_, index) => <div className="skeleton-group" key={index}><div className="skeleton skeleton-date" /><div className="skeleton-card"><div className="skeleton skeleton-avatar" /><div className="skeleton-card-body"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-meta" /><div className="skeleton skeleton-preview" /><div className="skeleton skeleton-people" /></div></div></div>)}</div>;
}
export function LibraryEmpty({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  const Icon = filtered ? SearchX : CalendarDays;
  return <div className="library-state"><div className="state-icon"><Icon size={28} strokeWidth={1.5} /></div><h2>{filtered ? "No matching meetings" : "Your next great conversation starts here"}</h2><p>{filtered ? "Try a different title, participant, or date range." : "Your recorded conversations will appear here, ready to revisit."}</p>{filtered && <button className="control-button" onClick={onClear}>Clear search and filters</button>}</div>;
}
export function LibraryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="library-state" role="alert"><div className="state-icon error-icon"><WifiOff size={28} strokeWidth={1.5} /></div><h2>Let’s try that again</h2><p>{message}</p><button className="control-button" onClick={onRetry}>Try again</button></div>;
}
