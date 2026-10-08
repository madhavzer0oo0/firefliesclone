import type { TranscriptMatch } from "@/lib/playback";

export function HighlightedText({ text, matches, selected = -1 }: { text: string; matches: TranscriptMatch[]; selected?: number }) {
  let cursor = 0;
  const parts: React.ReactNode[] = [];
  for (const match of matches) {
    parts.push(text.slice(cursor, match.start));
    parts.push(<mark key={match.index} className={match.index === selected ? "selected-match" : ""} data-selected={match.index === selected}>{text.slice(match.start, match.end)}</mark>);
    cursor = match.end;
  }
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}
