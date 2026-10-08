"use client";

import { useState } from "react";
import { Check, CheckCircle2, Circle, ListTodo, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ActionEditor } from "./action-editor";
import type { ActionItemsController } from "@/hooks/use-action-items";
import type { DetailResource } from "@/lib/meeting-detail";
import { initials } from "@/lib/meetings";
import { speakerColor } from "@/lib/playback";
import type { ActionItem, Meeting } from "@/types/api";

export function ActionItemsPanel({ meeting, resource, loading, controller, onRefresh }: { meeting: Meeting | null; resource: DetailResource<ActionItem[]> | null; loading: boolean; controller: ActionItemsController; onRefresh: () => void }) {
  const [editor, setEditor] = useState<{ item: ActionItem | null } | null>(null);
  const [deleting, setDeleting] = useState<ActionItem | null>(null);
  const items = resource?.data ?? [];
  const pending = items.filter(item => item.status === "open");
  const completed = items.filter(item => item.status === "completed");
  const disabled = controller.busy || loading || !meeting || Boolean(resource?.error);

  function renderItems(group: ActionItem[]) {
    return <ul className="action-items-list">{group.map(item => {
      const person = meeting?.participants.find(person => person.id === item.assignee_id);
      const done = item.status === "completed";
      return <li key={item.id} className={`action-item-row ${done ? "is-completed" : ""}`} data-testid="action-item" data-item-id={item.id} data-status={item.status}>
        <input type="checkbox" className="action-checkbox" aria-label={`Complete action item: ${item.text}`} checked={done} disabled={disabled} onChange={() => { void controller.update(item.id, { status: done ? "open" : "completed" }); }} />
        <div className="action-item-content"><p className="action-item-description">{item.text}</p><div className="action-item-meta">{person ? <><span className="action-person" style={{ background: speakerColor(person.id) }} aria-hidden="true">{initials(person.name)}</span><span>{person.name}</span></> : <><UserRound size={13} /><span>Unassigned</span></>}{item.due_date && <time dateTime={item.due_date}>Due {new Date(`${item.due_date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>}<span className={`action-item-status ${done ? "done" : ""}`}>{done ? <Check size={11} /> : <Circle size={10} />}{done ? "Completed" : "Pending"}</span></div></div>
        <div className="action-item-controls"><button className="icon-button" aria-label={`Edit action item: ${item.text}`} disabled={disabled} onClick={() => { controller.clearError(); setEditor({ item }); }}><Pencil size={15} /></button><button className="icon-button" aria-label={`Delete action item: ${item.text}`} disabled={disabled} onClick={() => { controller.clearError(); setDeleting(item); }}><Trash2 size={15} /></button></div>
      </li>;
    })}</ul>;
  }

  return <section className="action-items-panel" id="panel-actions" role="tabpanel" aria-labelledby="tab-actions" aria-busy={loading || controller.busy}>
    <div className="action-items-toolbar"><div><h2><ListTodo size={18} />Action items</h2><p>Track the next steps from this meeting.</p></div><Button size="sm" disabled={disabled} onClick={() => { controller.clearError(); setEditor({ item: null }); }}><Plus size={15} />Add action item</Button></div>
    <div className="action-progress"><span><Circle size={14} />{pending.length} pending</span><span><CheckCircle2 size={14} />{completed.length} completed</span></div>
    {controller.error && !editor && !deleting && <div className="action-operation-error" role="alert"><p>{controller.error}</p><button className="control-button" disabled={controller.busy || loading} onClick={() => { controller.clearError(); onRefresh(); }}>Refresh action items</button></div>}
    {loading ? <div className="action-items-loading" role="status" aria-label="Loading action items">{[1, 2, 3].map(index => <div key={index}><div className="skeleton" /><div className="skeleton" /></div>)}</div> : resource?.error ? <div className="action-items-empty" role="alert"><ListTodo size={30} /><h3>Action items unavailable</h3><p>{resource.error}</p><Button variant="outline" size="sm" onClick={onRefresh}>Retry action items</Button></div> : !items.length ? <div className="action-items-empty"><ListTodo size={32} /><h3>No action items yet</h3><p>Add a follow-up and assign an owner to get started.</p><Button variant="outline" size="sm" disabled={disabled} onClick={() => { controller.clearError(); setEditor({ item: null }); }}><Plus size={15} />Create your first action item</Button></div> : <>
      <section className="action-group" aria-label="Pending action items"><h3><Circle size={15} />Pending<span>{pending.length}</span></h3>{pending.length ? renderItems(pending) : <p className="action-group-empty">All caught up. No pending action items.</p>}</section>
      <section className="action-group" aria-label="Completed action items"><h3><CheckCircle2 size={15} />Completed<span>{completed.length}</span></h3>{completed.length ? renderItems(completed) : <p className="action-group-empty">Completed action items will appear here.</p>}</section>
    </>}
    {controller.busy && <p className="action-saving" role="status">Saving action item…</p>}
    {editor && <ActionEditor item={editor.item} participants={meeting?.participants ?? []} busy={controller.busy} error={controller.error} onClose={() => { setEditor(null); controller.clearError(); }} onSave={data => editor.item ? controller.update(editor.item.id, data) : controller.create(data)} />}
    {deleting && <Modal title="Delete action item?" busy={controller.busy} onClose={() => { setDeleting(null); controller.clearError(); }}><div className="action-delete-body"><p>This action item will be permanently removed from the meeting.</p><blockquote>{deleting.text}</blockquote>{controller.error && <p className="action-form-error" role="alert">{controller.error}</p>}</div><div className="app-modal-footer"><Button variant="outline" size="sm" disabled={controller.busy} onClick={() => { setDeleting(null); controller.clearError(); }}>Cancel</Button><Button size="sm" className="action-delete-confirm" disabled={controller.busy} onClick={async () => { if (await controller.remove(deleting.id)) setDeleting(null); }}>{controller.busy ? "Deleting…" : "Delete action item"}</Button></div></Modal>}
  </section>;
}
