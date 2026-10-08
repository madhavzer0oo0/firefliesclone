"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ActionCreate, ActionItem, Participant } from "@/types/api";

export function ActionEditor({ item, participants, busy, error, onClose, onSave }: { item: ActionItem | null; participants: Participant[]; busy: boolean; error: string | null; onClose: () => void; onSave: (data: ActionCreate) => Promise<boolean> }) {
  const [text, setText] = useState(item?.text ?? "");
  const [assignee, setAssignee] = useState(item?.assignee_id?.toString() ?? "");
  const [dueDate, setDueDate] = useState(item?.due_date ?? "");
  const [validation, setValidation] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) { setValidation("Enter an action item description."); return; }
    setValidation(null);
    // Status is deliberately omitted: editing a completed item must preserve completion.
    const saved = await onSave({ text: text.trim(), assignee_id: assignee ? Number(assignee) : null, due_date: dueDate || null });
    if (saved) onClose();
  }
  return <Modal title={item ? "Edit action item" : "Add action item"} busy={busy} onClose={onClose}>
    <form className="action-editor" onSubmit={submit}>
      <p className="action-editor-hint">Keep the next step clear and assign an owner.</p>
      <fieldset disabled={busy}>
        <label htmlFor="action-description">Description <span aria-hidden="true">*</span></label>
        <textarea id="action-description" data-autofocus value={text} onChange={event => setText(event.target.value)} maxLength={50000} rows={4} placeholder="What needs to happen next?" aria-required="true" aria-invalid={Boolean(validation)} aria-describedby={validation ? "action-validation" : undefined} />
        <div className="action-editor-fields"><div><label htmlFor="action-assignee">Assignee</label><select id="action-assignee" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="">Unassigned</option>{participants.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div><div><label htmlFor="action-due">Due date <span>(optional)</span></label><input id="action-due" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} min="0001-01-01" max="9999-12-31" /></div></div>
      </fieldset>
      {validation && <p className="action-form-error" id="action-validation" role="alert">{validation}</p>}
      {error && <p className="action-form-error" role="alert">{error}</p>}
      <div className="app-modal-footer"><Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : item ? "Save changes" : "Add action item"}</Button></div>
    </form>
  </Modal>;
}
