// The feed of the Timeline screen: pages of `GET /api/timeline`, newest first, the next one by the cursor of the last.
// Filters go to the server; a request whose filters changed (or whose screen went away) is aborted, never left to land late.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, qs } from "../api/client";
import { onInvalidate } from "../api/store";
import type { TlDayCount, TlPage, TlRow } from "../api/types";
import { TL_PAGE } from "./timeline";

const FEED = "/timeline";
const REFRESH_MS = 60_000;

export interface FeedParams {
  /** kinds shown, comma separated (all of them when absent) */
  type?: string;
  actor?: string;
  q?: string;
  /** `person:12`: only the events of one record */
  record?: string | null;
}

interface Pages {
  path: string;
  record: string | null;
  page: TlPage;
}
interface Older {
  path: string;
  rows: TlRow[];
  next: string | null;
  counts: Record<string, TlDayCount>;
}

const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";

export function useTimelineFeed(params: FeedParams, enabled = true) {
  const path = `${FEED}${qs({ type: params.type, actor: params.actor, q: params.q, record: params.record, limit: TL_PAGE })}`;
  const record = params.record ?? null;
  const [first, setFirst] = useState<Pages | null>(null);
  const [older, setOlder] = useState<Older | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [paging, setPaging] = useState(false);
  const [tick, setTick] = useState(0);
  const olderRequest = useRef<AbortController | null>(null);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  // the first page: asked again when the filters change or the data is stale
  useEffect(() => {
    if (!enabled) return;
    const request = new AbortController();
    api.get<TlPage>(path, request.signal).then(
      (page) => {
        setFirst({ path, record, page });
        setError(null);
      },
      (e: unknown) => {
        if (!isAbort(e)) setError(e as ApiError);
      },
    );
    return () => request.abort();
  }, [path, record, enabled, tick]);

  // other filters, other pages: drop the older ones and stop the request for them
  useEffect(() => {
    setOlder(null);
    setPaging(false);
    return () => olderRequest.current?.abort();
  }, [path]);

  // the same data stays fresh the way the other screens do: after a write, on return to the window, once a minute
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible") reload();
    };
    const off = onInvalidate((prefixes) => {
      if (prefixes.some((p) => FEED.startsWith(p))) reload();
    });
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(visible, REFRESH_MS);
    return () => {
      off();
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, [reload]);

  // while new filters load, the rows of the last answer stay (the same record only: another record's rows would be wrong)
  const shown = first && first.record === record ? first : null;
  const extra = shown && older?.path === shown.path ? older : null;
  const rows = useMemo(() => {
    if (!shown) return [];
    if (!extra) return shown.page.rows;
    const known = new Set(shown.page.rows.map((r) => r.id));
    return [...shown.page.rows, ...extra.rows.filter((r) => !known.has(r.id))];
  }, [shown, extra]);
  const counts = useMemo(() => ({ ...extra?.counts, ...shown?.page.day_counts }), [shown, extra]);
  // a cursor belongs to the filters that produced it: none while the answer for the new ones is on its way
  const next = shown?.path !== path ? null : extra ? extra.next : shown.page.next_before;

  const loadMore = useCallback(() => {
    if (!next || paging) return;
    const request = new AbortController();
    olderRequest.current = request;
    setPaging(true);
    api.get<TlPage>(`${path}&before=${next}`, request.signal).then(
      (page) => setOlder((o) => ({
        path,
        rows: [...(o?.path === path ? o.rows : []), ...page.rows],
        next: page.next_before,
        counts: { ...(o?.path === path ? o.counts : {}), ...page.day_counts },
      })),
      (e: unknown) => {
        if (!isAbort(e)) setError(e as ApiError);
      },
    ).finally(() => {
      if (!request.signal.aborted) setPaging(false);
    });
  }, [next, paging, path]);

  return { rows: enabled ? rows : [], counts, next: enabled ? next : null, ready: !enabled || !!shown, error, paging, loadMore, reload };
}
