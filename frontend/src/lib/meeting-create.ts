import { ApiError } from "@/lib/api";
import type { MeetingImport } from "@/types/api";

export const TRANSCRIPT_LIMIT = 1024 * 1024;

export async function readTranscriptFile(file: File): Promise<MeetingImport["transcript"]> {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  if (!["txt", "vtt", "json"].includes(extension ?? "")) throw new Error("Choose a .txt, .vtt, or .json transcript file.");
  if (!file.size) throw new Error("The transcript file is empty.");
  if (file.size > TRANSCRIPT_LIMIT) throw new Error("Transcript files must be at most 1 MiB.");
  let content: string;
  try { content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error("Use a UTF-8 text file. This file contains invalid text encoding."); }
  if (!content.trim()) throw new Error("The transcript file contains no text.");
  return { format: extension as MeetingImport["transcript"]["format"], filename: file.name, content };
}

export function importErrors(error: unknown): string[] {
  if (error instanceof ApiError) {
    if (Array.isArray(error.detail)) return error.detail.map((entry: unknown) => {
      if (entry && typeof entry === "object" && "msg" in entry && typeof entry.msg === "string") {
        const location = "loc" in entry && Array.isArray(entry.loc) ? entry.loc.filter(part => part !== "body").join(" · ").replaceAll("_", " ") : "";
        return `${location ? `${location}: ` : ""}${entry.msg}`;
      }
      return "Check the meeting details and transcript format.";
    });
    if (typeof error.detail === "string") return [error.detail];
  }
  return ["Couldn’t create the meeting. Check that the meeting service is running and try again."];
}
