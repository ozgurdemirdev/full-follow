// Küçük veri önbelleği (SWR benzeri, bağımlılıksız):
// - aynı anahtar tek istek (dedupe), sonuçlar bileşenler arasında paylaşılır
// - useSyncExternalStore ile sadece ilgili anahtar değişince yeniden çizim
// - pencereye dönünce ve görünürken belirli aralıkla tazeleme (Claude MCP'den yazınca ekran güncellensin)
// - abonesi kalmayan kayıtlar bir süre sonra silinir (bellek sınırlı kalır)
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { api, ApiError } from "./client";
import { endpointOn } from "./modules";

interface State<T> {
  data?: T;
  error?: ApiError;
  loading: boolean;
}
interface Entry {
  state: State<unknown>;
  subs: Set<() => void>;
  fetchedAt: number;
  inflight?: Promise<void>;
  /** invalidate() came while a request was in flight: its answer may predate the change, so ask again once it lands */
  stale?: boolean;
  lastUsed: number;
  /** how the key is read when it is not one plain GET (a list read page by page: see `drainPages`) */
  fetcher?: Fetcher;
}
type Fetcher = (key: string) => Promise<unknown>;

const STALE_MS = 10_000;
const REFRESH_MS = 60_000;
const EVICT_MS = 5 * 60_000;
const MAX_IDLE = 40;

const cache = new Map<string, Entry>();
const EMPTY: State<unknown> = { loading: true };
const ABSENT: State<unknown> = { loading: false };

function entry(key: string, fetcher?: Fetcher): Entry {
  let e = cache.get(key);
  if (!e) {
    e = { state: EMPTY, subs: new Set(), fetchedAt: 0, lastUsed: Date.now() };
    cache.set(key, e);
  }
  if (fetcher && !e.fetcher) e.fetcher = fetcher;
  return e;
}

function set(e: Entry, next: State<unknown>) {
  e.state = next;
  e.subs.forEach((fn) => fn());
}

function load(key: string): Promise<void> {
  const e = entry(key);
  if (e.inflight) return e.inflight;
  if (e.state.error) set(e, { ...e.state, loading: true, error: undefined });
  e.inflight = (e.fetcher ?? ((k) => api.get<unknown>(k)))(key)
    .then(
      (data) => set(e, { data, loading: false }),
      (error: ApiError) => set(e, { data: e.state.data, error, loading: false }),
    )
    .finally(() => {
      e.inflight = undefined;
      if (!e.stale) return void (e.fetchedAt = Date.now());
      e.stale = false;
      if (e.subs.size) void load(key);
    });
  return e.inflight;
}

function evict() {
  const now = Date.now();
  const idle = [...cache.entries()].filter(([, e]) => e.subs.size === 0 && !e.inflight);
  for (const [k, e] of idle) if (now - e.lastUsed > EVICT_MS) cache.delete(k);
  if (idle.length > MAX_IDLE) {
    idle.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [k] of idle.slice(0, idle.length - MAX_IDLE)) cache.delete(k);
  }
}

/** GET /api{key}. key null ise istek yapılmaz. */
export function useQuery<T>(wanted: string | null, fetcher?: Fetcher): State<T> & { reload: () => Promise<void> } {
  // an endpoint whose module is not installed is never asked for: its answer is "nothing", settled
  const key = wanted && endpointOn(wanted) ? wanted : null;
  const subscribe = useCallback(
    (fn: () => void) => {
      if (!key) return () => {};
      const e = entry(key, fetcher);
      e.subs.add(fn);
      e.lastUsed = Date.now();
      return () => {
        e.subs.delete(fn);
        e.lastUsed = Date.now();
      };
    },
    [key],
  );
  const snap = useCallback(() => (key ? entry(key, fetcher).state : wanted ? ABSENT : EMPTY), [key, wanted, fetcher]);
  const state = useSyncExternalStore(subscribe, snap) as State<T>;

  useEffect(() => {
    if (!key) return;
    const e = entry(key, fetcher);
    if (!e.inflight && Date.now() - e.fetchedAt > STALE_MS) void load(key);
  }, [key, fetcher]);

  const reload = useCallback(() => {
    if (!key) return Promise.resolve();
    entry(key, fetcher);
    return load(key);
  }, [key, fetcher]);
  return { ...state, reload };
}

/** Several keys at once (the pages of one list): one state per key, the same array while none of them changed */
export function useQueries<T>(wanted: readonly string[]): State<T>[] {
  const joined = wanted.map((w) => (endpointOn(w) ? w : "")).join("\n");
  const count = wanted.length;
  const last = useRef<State<unknown>[]>([]);
  const subscribe = useCallback(
    (fn: () => void) => {
      const live = joined.split("\n").filter(Boolean).map((k) => entry(k));
      for (const e of live) {
        e.subs.add(fn);
        e.lastUsed = Date.now();
      }
      return () => {
        for (const e of live) {
          e.subs.delete(fn);
          e.lastUsed = Date.now();
        }
      };
    },
    [joined, count],
  );
  const snap = useCallback(() => {
    const next = count ? joined.split("\n").map((k) => (k ? entry(k).state : ABSENT)) : [];
    if (next.length === last.current.length && next.every((s, i) => s === last.current[i])) return last.current;
    return (last.current = next);
  }, [joined, count]);
  const states = useSyncExternalStore(subscribe, snap) as State<T>[];
  useEffect(() => {
    for (const k of joined.split("\n").filter(Boolean)) {
      const e = entry(k);
      if (!e.inflight && Date.now() - e.fetchedAt > STALE_MS) void load(k);
    }
  }, [joined, count]);
  return states;
}

/** Önbellekteki veriyi elle değiştir (iyimser güncelleme). Geri almak için önceki değeri döner. */
export function mutate<T>(key: string, fn: (prev: T | undefined) => T | undefined): T | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  const prev = e.state.data as T | undefined;
  set(e, { ...e.state, data: fn(prev) });
  return prev;
}

const invalidated = new Set<(prefixes: string[]) => void>();
/** invalidate() çağrılınca haber ver: kendi sayfalı verisini tutan görünümler (önbellekte kaydı olmayanlar) için */
export const onInvalidate = (fn: (prefixes: string[]) => void) => {
  invalidated.add(fn);
  return () => void invalidated.delete(fn);
};

/** Değişiklikten sonra: verilen önekle başlayan anahtarları tazele (abonesi olanlar hemen, diğerleri sonra) */
export function invalidate(...prefixes: string[]) {
  invalidated.forEach((fn) => fn(prefixes));
  for (const [k, e] of cache) {
    if (!prefixes.some((p) => k.startsWith(p))) continue;
    e.fetchedAt = 0;
    if (e.inflight) e.stale = true;
    else if (e.subs.size) void load(k);
  }
}

/** Ekrandaki her şeyi tazele */
function refreshVisible() {
  const now = Date.now();
  for (const [k, e] of cache) if (e.subs.size && now - e.fetchedAt > STALE_MS) void load(k);
  evict();
}

if (typeof window !== "undefined") {
  window.addEventListener("focus", refreshVisible);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshVisible();
  });
  setInterval(() => {
    if (document.visibilityState === "visible") {
      for (const [k, e] of cache) if (e.subs.size && Date.now() - e.fetchedAt > REFRESH_MS) void load(k);
    }
    evict();
  }, REFRESH_MS / 2);
}

/** Önceden yükle (ör. menü öğesinin üzerine gelince) */
export const prefetch = (key: string) => {
  const e = entry(key);
  if (!e.inflight && Date.now() - e.fetchedAt > STALE_MS) void load(key);
};
