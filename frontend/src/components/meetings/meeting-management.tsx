"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { meetingMutationError, notifyMeetingsChanged } from "@/lib/meeting-management";
import type { Meeting, MeetingUpdate, ParticipantInput } from "@/types/api";

type Person = ParticipantInput & { key: number; id?: number };

function MeetingEditor({ meeting, busy, error, onClose, onSave }: { meeting: Meeting; busy: boolean; error: string | null; onClose: () => void; onSave: (data: MeetingUpdate) => Promise<void> }) {
  const [title, setTitle] = useState(meeting.title);
  const [people, setPeople] = useState<Person[]>(meeting.participants.map(person => ({ ...person, key: person.id })));
  const nextKey = useRef(-1);
  const [validation, setValidation] = useState<string | null>(null);
  const [links, setLinks] = useState<{ ids: number[]; checking: boolean; error: boolean }>({ ids: [], checking: true, error: false });
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([api.getTranscript(meeting.id, undefined, abort.signal), api.listActionItems(meeting.id, undefined, abort.signal)]).then(([segments, actions]) => {
      if (!abort.signal.aborted) setLinks({ ids: [...new Set([...segments.map(segment => segment.speaker_id), ...actions.flatMap(action => action.assignee_id === null ? [] : [action.assignee_id])])], checking: false, error: false });
    }).catch(() => { if (!abort.signal.aborted) setLinks({ ids: [], checking: false, error: true }); });
    return () => abort.abort();
  }, [meeting.id]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) { setValidation("Enter a meeting title."); return; }
    if (people.some(person => !person.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email.trim()))) { setValidation("Each participant needs a name and valid email."); return; }
    if (new Set(people.map(person => person.email.trim().toLowerCase())).size !== people.length) { setValidation("Participant emails must be unique."); return; }
    setValidation(null);
    await onSave({ title: title.trim(), participants: people.map(person => ({ name: person.name.trim(), email: person.email.trim() })) });
  }
  return <Modal title="Edit meeting" busy={busy} onClose={onClose} fallbackFocus=".global-search input">
    <form className="meeting-editor" onSubmit={submit} noValidate>
      <p className="meeting-editor-hint">Update the title and people in this conversation.</p>
      <fieldset disabled={busy}>
        <label htmlFor="edit-meeting-title">Meeting title</label><input id="edit-meeting-title" data-autofocus value={title} maxLength={200} aria-required="true" onChange={event => setTitle(event.target.value)} />
        <h3><Users size={15} />Participants</h3>
        <p className="meeting-participant-help">Existing contacts keep their shared name and email. Add or remove people to change this meeting’s participants. Speakers and task assignees must remain linked.</p>
        {links.checking && <p className="meeting-link-note" role="status">Checking linked participants…</p>}
        {links.error && <p className="meeting-link-note">Couldn’t check participant links. Reopen this dialog to enable removal; title edits and additions are still available.</p>}
        <div className="meeting-editor-people">{people.map((person, index) => {
          const locked = person.id !== undefined && (links.checking || links.error || links.ids.includes(person.id));
          return <div className="meeting-editor-person" key={person.key}><div><label htmlFor={`edit-person-name-${person.key}`}>Participant {index + 1} name</label><input id={`edit-person-name-${person.key}`} readOnly={person.id !== undefined} value={person.name} maxLength={120} onChange={event => setPeople(items => items.map(item => item.key === person.key ? { ...item, name: event.target.value } : item))} /></div><div><label htmlFor={`edit-person-email-${person.key}`}>Participant {index + 1} email</label><input id={`edit-person-email-${person.key}`} type="email" readOnly={person.id !== undefined} value={person.email} maxLength={254} onChange={event => setPeople(items => items.map(item => item.key === person.key ? { ...item, email: event.target.value } : item))} /></div><button type="button" className="icon-button" aria-label={`Remove participant ${index + 1}`} disabled={locked} title={locked ? "Referenced by a transcript or task, or links are still being checked" : `Remove ${person.name || "participant"}`} onClick={() => setPeople(items => items.filter(item => item.key !== person.key))}><Trash2 size={15} /></button>{person.id !== undefined && <span className="meeting-person-note">{links.ids.includes(person.id) ? "Linked to transcript or tasks" : "Existing shared contact"}</span>}</div>;
        })}</div>
        {!people.length && <p className="meeting-link-note">No participants. Add a person if needed.</p>}
        <button type="button" className="create-add-participant" disabled={people.length >= 100} onClick={() => setPeople(items => [...items, { key: nextKey.current--, name: "", email: "" }])}><Plus size={14} />Add participant</button>
      </fieldset>
      {(validation || error) && <p className="action-form-error" role="alert">{validation || error}</p>}
      <div className="app-modal-footer"><Button type="button" size="sm" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save meeting"}</Button></div>
    </form>
  </Modal>;
}

export function MeetingManagementDialogs({ meeting, mode, onClose, onSaved, onDeleted }: { meeting: Meeting; mode: "edit" | "delete"; onClose: () => void; onSaved?: (meeting: Meeting) => void; onDeleted?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function mutate(operation: "save" | "delete", data?: MeetingUpdate) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try {
      if (operation === "save") {
        const saved = await api.updateMeeting(meeting.id, data!);
        if (mounted.current) { onSaved?.(saved); toast.success("Meeting updated."); }
      } else {
        await api.deleteMeeting(meeting.id);
        if (mounted.current) { toast.success("Meeting deleted."); onDeleted?.(); }
      }
      notifyMeetingsChanged();
      if (mounted.current) onClose();
    } catch (error) {
      if (mounted.current) { const message = meetingMutationError(error, operation); setError(message); toast.error(message); }
    } finally { locked.current = false; if (mounted.current) setBusy(false); }
  }
  if (mode === "edit") return <MeetingEditor meeting={meeting} busy={busy} error={error} onClose={onClose} onSave={data => mutate("save", data)} />;
  return <Modal title="Delete meeting?" busy={busy} onClose={onClose} fallbackFocus=".global-search input"><div className="action-delete-body"><p>This permanently deletes the meeting, its transcript, summary, chapters, and action items. Shared contacts remain in the workspace.</p><blockquote>{meeting.title}</blockquote>{error && <p className="action-form-error" role="alert">{error}</p>}</div><div className="app-modal-footer"><Button size="sm" variant="outline" data-autofocus disabled={busy} onClick={onClose}>Cancel</Button><Button size="sm" className="action-delete-confirm" disabled={busy} onClick={() => { void mutate("delete"); }}>{busy ? "Deleting…" : "Delete meeting"}</Button></div></Modal>;
}
