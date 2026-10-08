"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { ActionCreate, ActionItem, ActionUpdate } from "@/types/api";

export function useActionItems(meetingId: number, onSaved: (item: ActionItem | null, deletedId?: number) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const mutate = useCallback(async (operation: () => Promise<ActionItem | void>, message: string, deletedId?: number) => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true); setError(null);
    try {
      const saved = await operation();
      if (mounted.current) { onSaved(saved ?? null, deletedId); toast.success(message); }
      return true;
    } catch (cause) {
      const message = cause instanceof ApiError && cause.status === 404
        ? "This action item or meeting no longer exists. Refresh the meeting and try again."
        : cause instanceof ApiError && cause.status === 422
          ? "Check the description, assignee, and due date, then try again."
          : "Couldn’t save the action item. Check your connection and try again.";
      if (mounted.current) { setError(message); toast.error(message); }
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [onSaved]);

  return {
    busy, error, clearError: () => setError(null),
    create: (data: ActionCreate) => mutate(() => api.createActionItem(meetingId, data), "Action item added."),
    update: (id: number, data: ActionUpdate) => mutate(() => api.updateActionItem(meetingId, id, data), data.status ? data.status === "completed" ? "Action item completed." : "Action item marked pending." : "Action item updated."),
    remove: (id: number) => mutate(() => api.deleteActionItem(meetingId, id), "Action item deleted.", id),
  };
}

export type ActionItemsController = ReturnType<typeof useActionItems>;
