// Lists the server answers page by page: nothing asks for more than a named page, and `total` is read, never guessed.
// - `drainPages` reads a list that the screen needs whole (open tasks, opportunities of the board, comments), a page at a time, into one cache entry
// - `usePaged` is an endless list (people, companies): pages come as the end is scrolled into view, each page is its own cache entry,
//   so a revisit shows the pages at once and a write refreshes the ones on screen like any other key
import { useCallback, useEffect, useMemo, useState } from "react";
import { DRAIN_PAGE } from "../lib/constants";
import { api, qs } from "./client";
import { invalidate, useQueries } from "./store";
import type { List } from "./types";

/** `path` with the page asked for (`path` may already carry a query) */
export function withPaging(path: string, limit: number, offset: number): string {
  return `${path}${path.includes("?") ? "&" : "?"}${qs({ limit, offset }).slice(1)}`;
}

/** Reads a whole list a page at a time. The first page's other fields (`meta`, `counts`) stay on the result. */
export async function drainPages<T, X extends object = object>(path: string, size = DRAIN_PAGE): Promise<List<T> & X> {
  const first = await api.get<List<T> & X>(withPaging(path, size, 0));
  const rows = [...first.rows];
  while (rows.length < first.total) {
    const next = await api.get<List<T>>(withPaging(path, size, rows.length));
    if (!next.rows.length) break;
    rows.push(...next.rows);
  }
  return { ...first, rows };
}

/** The fetcher that reads a store key as a whole list (a stable function, so the cache entry keeps it) */
export const drained = (key: string) => drainPages(key);

interface Shown<T, X> {
  rows: T[];
  total: number;
  extra: X | undefined;
}

/**
 * An endless list: `base` is the path with every filter in it; the first page is loaded, `loadMore` asks for the next.
 * Another `base` (a filter changed) starts over at the first page, and the rows of the last answer stay on screen until the new first page lands.
 */
export function usePaged<T extends { id: number }, X extends object = object>(base: string | null, size: number) {
  const [asked, setAsked] = useState<{ base: string | null; pages: number }>({ base, pages: 1 });
  const pages = asked.base === base ? asked.pages : 1;
  const keys = useMemo(() => (base ? Array.from({ length: pages }, (_, i) => withPaging(base, size, i * size)) : []), [base, size, pages]);
  const states = useQueries<List<T> & X>(keys);

  const first = states[0];
  const [kept, setKept] = useState<Shown<T, X>>({ rows: [], total: 0, extra: undefined });
  const fresh = useMemo<Shown<T, X> | null>(() => {
    if (!first?.data) return null;
    const seen = new Set<number>();
    const rows: T[] = [];
    for (const s of states) for (const r of s.data?.rows ?? []) if (!seen.has(r.id)) (seen.add(r.id), rows.push(r));
    return { rows, total: first.data.total, extra: first.data };
  }, [states, first]);
  useEffect(() => {
    if (fresh) setKept(fresh);
  }, [fresh]);
  const shown = fresh ?? kept;

  const settled = states.length > 0 && states.every((s) => !s.loading);
  const hasMore = !!fresh && settled && pages * size < fresh.total;
  const loadMore = useCallback(() => setAsked((a) => ({ base, pages: (a.base === base ? a.pages : 1) + 1 })), [base]);
  const error = states.find((s) => s.error)?.error;
  return {
    rows: shown.rows,
    total: shown.total,
    extra: shown.extra,
    /** the first page of this `base` has not arrived: `rows` are still the previous answer (or empty at the very start) */
    pending: !fresh && !!base,
    hasMore,
    loadMore,
    error: fresh ? undefined : error,
    reload: useCallback(() => {
      if (base) invalidate(base);
      return Promise.resolve();
    }, [base]),
  };
}
