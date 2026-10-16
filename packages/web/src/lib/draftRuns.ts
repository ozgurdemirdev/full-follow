import { useMemo, useSyncExternalStore } from "react";
import { recordHref, refreshResource } from "../api/actions";
import { api } from "../api/client";
import { endpointOn } from "../api/modules";
import { toast } from "../components/toast";
import { m } from "../messages";
import { runKey, type DraftRun } from "./claudeRequest";

/** The chat module's draft queue: requests a background Claude run writes now */
export const DRAFT_RUNS_PATH = "/draft-runs";
/** Failed runs are kept (so a replayed event does not toast twice) up to this many, then dropped */
const FAILED_KEEP = 20;

const NONE: ReadonlyMap<string, DraftRun> = new Map();
/** The latest run of each request (title and record), across every button on screen */
let runs = NONE;
const subs = new Set<() => void>();
let source: EventSource | null = null;

const publish = (next: ReadonlyMap<string, DraftRun>) => {
  runs = next;
  subs.forEach((fn) => fn());
};

function dropOldFailed(map: Map<string, DraftRun>) {
  const failed = [...map].filter(([, r]) => r.state === "failed").sort((a, b) => a[1].id - b[1].id);
  for (const [k] of failed.slice(0, Math.max(0, failed.length - FAILED_KEEP))) map.delete(k);
}

/** Stores a run; `live` (an event of the stream) toasts a change of state the screen has not seen yet */
export function putRun(run: DraftRun, live = false) {
  const key = runKey(run);
  const prev = runs.get(key);
  if (prev && prev.id > run.id) return;
  if (prev?.id === run.id && prev.state === run.state && prev.draft_id === run.draft_id) return;
  const next = new Map(runs).set(key, run);
  dropOldFailed(next);
  publish(next);
  if (!live || prev?.state === run.state) return;
  if (run.state === "done") {
    // the draft, Claude's closed task and every list that shows them
    refreshResource("drafts");
    refreshResource("tasks");
    toast(m.draftRun.readyToast(run.title), "saved", run.draft_id ? { label: m.open, href: recordHref("draft", run.draft_id) } : undefined);
  } else if (run.state === "failed") {
    refreshResource("tasks");
    toast(m.draftRun.failed(run.error ?? ""), "error");
  }
}

/** The list the buttons start from (active runs and the ready ones); runs that are no longer listed keep their last known state */
async function load() {
  try {
    const r = await api.get<{ rows: DraftRun[] }>(DRAFT_RUNS_PATH);
    for (const run of [...r.rows].reverse()) putRun(run);
  } catch {
    /* the buttons fall back to their idle state */
  }
}

function open() {
  if (source || !endpointOn(DRAFT_RUNS_PATH)) return;
  void load();
  const es = new EventSource(`/api${DRAFT_RUNS_PATH}/stream`, { withCredentials: true });
  es.addEventListener("run", (e) => putRun(JSON.parse((e as MessageEvent<string>).data) as DraftRun, true));
  // the server could not replay what was missed (it restarted): read the list again
  es.addEventListener("snapshot", () => void load());
  source = es;
}

function close() {
  source?.close();
  source = null;
}

/** One stream for every subscriber: opened by the first, closed with the last */
function subscribe(fn: () => void) {
  subs.add(fn);
  open();
  return () => {
    subs.delete(fn);
    if (!subs.size) close();
  };
}
const idle = () => () => {};
const snapshot = () => runs;
const empty = () => NONE;

/** The latest run per request key while `on` (auto drafting is usable); nothing is opened while it is off */
export function useDraftRuns(on: boolean): ReadonlyMap<string, DraftRun> {
  return useSyncExternalStore(on ? subscribe : idle, on ? snapshot : empty);
}

/** True while any draft run is queued or running (the mascot works meanwhile) */
export function useDraftActive(on: boolean): boolean {
  const map = useDraftRuns(on);
  return useMemo(() => [...map.values()].some((r) => r.state === "queued" || r.state === "running"), [map]);
}
