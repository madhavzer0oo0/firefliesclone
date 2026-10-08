"use client";

import { useEffect, useState } from "react";
import { fetchLibrary, libraryError, type LibraryFilters } from "@/lib/meetings";
import type { MeetingPage } from "@/types/api";
import { MEETINGS_CHANGED } from "@/lib/meeting-management";

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

type Result = { key: string; data: MeetingPage | null; error: string | null };

export function useMeetings(filters: LibraryFilters) {
  const [result, setResult] = useState<Result | null>(null);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify({ ...filters, revision });
  const invalidDates = Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    const visible = () => { if (!document.hidden) refresh(); };
    window.addEventListener(MEETINGS_CHANGED, refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener(MEETINGS_CHANGED, refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  useEffect(() => {
    if (invalidDates) return;
    const controller = new AbortController();
    const { revision: _revision, ...query } = JSON.parse(key) as LibraryFilters & { revision: number };
    void _revision;
    fetchLibrary(query, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, data, error: null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, data: null, error: libraryError(error) });
    });
    return () => controller.abort();
  }, [key, invalidDates]);

  return {
    data: !invalidDates && result?.key === key ? result.data : null,
    error: invalidDates ? "The end date must be on or after the start date." : result?.key === key ? result.error : null,
    loading: !invalidDates && result?.key !== key,
    retry: () => setRevision(value => value + 1),
  };
}
