"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, FileText, Info, LoaderCircle, Menu, Plus, Sparkles, Trash2, Upload, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "@/components/workspace/sidebar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { importErrors, readTranscriptFile, TRANSCRIPT_LIMIT } from "@/lib/meeting-create";
import type { MeetingImport, ParticipantInput } from "@/types/api";

export function CreateMeeting() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeSidebar = useCallback(() => setMobileOpen(false), []);
  const [title, setTitle] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [minutes, setMinutes] = useState("");
  const [participants, setParticipants] = useState<(ParticipantInput & { key: number })[]>([{ key: 0, name: "", email: "" }]);
  const nextKey = useRef(1);
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [upload, setUpload] = useState<MeetingImport["transcript"] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const readGeneration = useRef(0);
  const [summary, setSummary] = useState("");
  const [actions, setActions] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [errors, setErrors] = useState<string[]>([]);
  const errorBox = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (errors.length) errorBox.current?.focus(); }, [errors]);

  async function chooseFile(file?: File) {
    const generation = ++readGeneration.current;
    setUpload(null); setFileError(null);
    if (!file) { setReading(false); return; }
    setReading(true);
    try {
      const transcript = await readTranscriptFile(file);
      if (mounted.current && generation === readGeneration.current) setUpload(transcript);
    } catch (error) {
      if (mounted.current && generation === readGeneration.current) setFileError(error instanceof Error ? error.message : "Couldn’t read this file.");
    } finally { if (mounted.current && generation === readGeneration.current) setReading(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || reading) return;
    const problems: string[] = [];
    if (!title.trim()) problems.push("Enter a meeting title.");
    const started = new Date(dateTime);
    if (!dateTime || Number.isNaN(started.getTime())) problems.push("Choose a valid date and time.");
    else {
      const local = `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, "0")}-${String(started.getDate()).padStart(2, "0")}T${String(started.getHours()).padStart(2, "0")}:${String(started.getMinutes()).padStart(2, "0")}`;
      if (local !== dateTime.slice(0, 16)) problems.push("This date and time does not exist in your local time zone. Choose another time.");
    }
    const duration = Number(minutes) * 60;
    if (!minutes || !Number.isSafeInteger(duration) || duration <= 0) problems.push("Enter a duration greater than zero in minutes (up to second precision).");
    participants.forEach((person, index) => {
      if (!person.name.trim()) problems.push(`Participant ${index + 1}: enter a name.`);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email.trim())) problems.push(`Participant ${index + 1}: enter a valid email.`);
    });
    const transcript = mode === "paste" ? { format: "txt" as const, content: text } : upload;
    if (!transcript?.content.trim()) problems.push(mode === "paste" ? "Paste a transcript before creating the meeting." : "Choose a valid transcript file before creating the meeting.");
    if (transcript && new TextEncoder().encode(transcript.content).length > TRANSCRIPT_LIMIT) problems.push("Transcript must be at most 1 MiB.");
    if (problems.length) { setErrors(problems); return; }
    submitting.current = true; setBusy(true); setErrors([]);
    try {
      const result = await api.importMeeting({
        title: title.trim(), started_at: started.toISOString(), duration_seconds: duration,
        source: mode === "upload" ? "Transcript upload" : "Pasted transcript",
        participants: participants.map(({ name, email }) => ({ name: name.trim(), email: email.trim() })),
        transcript: transcript!, ...(summary.trim() ? { summary: { overview: summary.trim() } } : {}),
        ...(actions.trim() ? { action_items: actions.split(/\n/).map(line => line.trim()).filter(Boolean).map(text => ({ text })) } : {}),
      });
      if (!mounted.current) return;
      toast.success("Meeting created.");
      if (result.warnings.length) toast.info(result.warnings.join(" "), { duration: 12000 });
      router.push(`/meetings/${result.meeting.id}`);
    } catch (error) {
      if (mounted.current) { setErrors(importErrors(error)); toast.error("Meeting wasn’t created. Review the highlighted errors."); }
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <div className="meeting-workspace create-meeting-workspace">
    <Sidebar channel="my" onChannelChange={() => router.push("/meetings")} mobileOpen={mobileOpen} onClose={closeSidebar} disabledPlaceholders />
    <div className="workspace-main" inert={mobileOpen}>
      <header className="create-topbar"><div><button className="icon-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><Link href="/meetings"><ArrowLeft size={15} />Meetings</Link><span>/</span><span>Create meeting</span></div><span className="profile-avatar">DU</span></header>
      <main id="main-content" className="create-meeting-content">
        <div className="create-page-heading"><span className="create-heading-icon"><Video size={22} /></span><div><h1>Create meeting</h1><p>Bring your conversation into one organized workspace.</p></div></div>
        <div className="create-page-grid"><form onSubmit={submit} noValidate className="create-meeting-form" aria-label="Create meeting" aria-busy={busy}>
          {errors.length > 0 && <div className="create-errors" role="alert" ref={errorBox} tabIndex={-1}><h2>Review your meeting</h2><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
          <fieldset disabled={busy}><section className="create-form-card"><div className="create-section-title"><Video size={17} /><h2>Meeting details</h2><span>Required</span></div>
            <label htmlFor="meeting-title">Meeting title</label><input id="meeting-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={200} placeholder="e.g. Weekly product sync" required />
            <div className="create-fields-row"><div><label htmlFor="meeting-date">Date and time</label><input id="meeting-date" type="datetime-local" value={dateTime} onChange={event => setDateTime(event.target.value)} required /><p className="create-field-hint">Your local time zone</p></div><div><label htmlFor="meeting-duration">Duration (minutes)</label><input id="meeting-duration" type="number" min={1 / 60} step="any" value={minutes} onChange={event => setMinutes(event.target.value)} placeholder="30" required /></div></div>
          </section>
          <section className="create-form-card"><div className="create-section-title"><Users size={17} /><h2>Participants</h2><span>Required</span></div><p className="create-section-hint">Use names as they appear in the transcript to match speakers.</p>
            <div className="create-participants">{participants.map((person, index) => <div className="create-participant-row" key={person.key}><div><label htmlFor={`person-name-${person.key}`}>Participant {index + 1} name</label><input id={`person-name-${person.key}`} value={person.name} maxLength={120} placeholder="Full name" required onChange={event => setParticipants(items => items.map(item => item.key === person.key ? { ...item, name: event.target.value } : item))} /></div><div><label htmlFor={`person-email-${person.key}`}>Participant {index + 1} email</label><input id={`person-email-${person.key}`} type="email" value={person.email} maxLength={254} placeholder="name@company.com" required onChange={event => setParticipants(items => items.map(item => item.key === person.key ? { ...item, email: event.target.value } : item))} /></div><button type="button" className="icon-button" aria-label={`Remove participant ${index + 1}`} disabled={participants.length === 1} onClick={() => setParticipants(items => items.filter(item => item.key !== person.key))}><Trash2 size={15} /></button></div>)}</div>
            <button type="button" className="create-add-participant" disabled={participants.length >= 100} onClick={() => setParticipants(items => [...items, { key: nextKey.current++, name: "", email: "" }])}><Plus size={14} />Add participant</button>
          </section>
          <section className="create-form-card"><div className="create-section-title"><FileText size={17} /><h2>Transcript</h2><span>Required</span></div><div className="create-input-modes" role="group" aria-label="Transcript input method"><button type="button" aria-pressed={mode === "paste"} onClick={() => setMode("paste")}><FileText size={15} />Paste text</button><button type="button" aria-pressed={mode === "upload"} onClick={() => setMode("upload")}><Upload size={15} />Upload file</button></div>
            {mode === "paste" ? <><label htmlFor="meeting-transcript">Transcript text</label><textarea id="meeting-transcript" value={text} onChange={event => setText(event.target.value)} rows={8} maxLength={1048576} placeholder={'[00:00] Priya: Let’s review the plan.\n[00:15] Arjun: I’ll share the next steps.'} required /></> : <div className="create-upload"><Upload size={28} /><h3>Upload your transcript</h3><p>UTF-8 .txt, .vtt, or .json · Up to 1 MiB</p><label htmlFor="transcript-file">Choose transcript file</label><input id="transcript-file" type="file" accept=".txt,.vtt,.json" onChange={event => { void chooseFile(event.target.files?.[0]); }} />{reading && <p role="status">Reading transcript…</p>}{upload && <p className="create-upload-selected"><Check size={14} />{upload.filename}</p>}{fileError && <p role="alert" className="create-file-error">{fileError}</p>}</div>}
            <div className="create-transcript-note"><Info size={15} /><p>Supplied timestamps and speaker labels are preserved. Plain text without timestamps uses evenly spaced, <strong>estimated timing</strong>. Unlabeled text stays <strong>Unknown speaker</strong>.</p></div>
            <details className="create-format-help"><summary>Supported transcript formats</summary><p>TXT: [MM:SS] Speaker: text, or plain text. Continuation lines follow the preceding timestamp. VTT: WEBVTT cues with &lt;v Speaker&gt; voice labels. JSON: an array of segments, or an object with segments and optional summary/action_items.</p><pre>{'[{"speaker":"Priya","start_seconds":0.5,"end_seconds":15,"text":"Review the plan."}]'}</pre><p>JSON ends are optional and inferred from the next start or duration. Overlapping ranges and timestamps beyond the duration are rejected. Unmatched labels are preserved as imported identities with placeholder emails.</p></details>
          </section>
          <section className="create-form-card"><div className="create-section-title"><Sparkles size={17} /><h2>Notes & follow-ups</h2><span>Optional</span></div><label htmlFor="meeting-summary">Meeting summary</label><textarea id="meeting-summary" value={summary} maxLength={50000} onChange={event => setSummary(event.target.value)} rows={3} placeholder="Add an existing summary, if you have one." /><label htmlFor="meeting-actions">Action items</label><textarea id="meeting-actions" value={actions} maxLength={100000} onChange={event => setActions(event.target.value)} rows={3} placeholder="One follow-up per line" /><p className="create-field-hint">Items entered here are pending and unassigned. JSON imports can include assignees, status, and due dates.</p></section>
          </fieldset>
          <div className="create-form-footer"><span>Saved to your meeting library</span><Button type="button" variant="outline" disabled={busy} onClick={() => router.push("/meetings")}>Cancel</Button><Button type="submit" disabled={busy || reading}>{busy ? <LoaderCircle size={16} className="refreshing" /> : <Plus size={16} />}{busy ? "Creating meeting…" : "Create meeting"}</Button></div>
        </form><aside className="create-help-card"><div className="create-help-icon"><Sparkles size={21} /></div><h2>A home for every conversation</h2><p>Import a saved transcript and keep the details, speakers, and follow-ups together.</p><ul><li><Check size={14} />Searchable meeting transcript</li><li><Check size={14} />Summary and discussion notes</li><li><Check size={14} />Persistent action items</li></ul><div><Info size={15} /><p>This imports text transcripts. It does not transcribe audio or generate an AI summary.</p></div></aside></div>
      </main>
    </div>
  </div>;
}
