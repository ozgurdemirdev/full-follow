import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { refreshResource, report, run } from "../api/actions";
import { toast } from "../components/toast";
import { K, useOpenTasks } from "../api/keys";
import { useEndpointVisible } from "../api/modules";
import { useQuery } from "../api/store";
import type { PriceFloor } from "../api/types";
import { openRequestKeys, requestKey, type ClaudeRequest, type DraftRun } from "./claudeRequest";
import { DRAFT_RUNS_PATH, putRun, useDraftRuns } from "./draftRuns";
import { todayIso } from "./format";
import { useTasksOn } from "./taskAccess";

export type { ClaudeRequest, ClaudeTarget } from "./claudeRequest";

/** Where a request is: not asked, asked as Claude's task, being written by a background run, or written (the run's draft waits) */
export type AskState = { kind: "idle" } | { kind: "asked" } | { kind: "writing"; run?: DraftRun } | { kind: "ready"; run: DraftRun };

const DRAFTS_PATH = "/drafts";

/** A draft request starts a background Claude run: the chat module (the queue) and the drafts module are on, and so is the setting */
export function useAutoDraft(): boolean {
  const queue = useEndpointVisible(DRAFT_RUNS_PATH);
  const drafts = useEndpointVisible(DRAFTS_PATH);
  const settings = useQuery<PriceFloor>(queue && drafts ? K.settings : null);
  return queue && drafts && settings.data?.draft_auto === true;
}

/** Whether a button for this request is drawn: Claude's tasks exist (the calendar module), or a background run can write the draft */
export function useCanAsk() {
  const tasksOn = useTasksOn();
  const auto = useAutoDraft();
  return useCallback((r: ClaudeRequest) => tasksOn || (auto && !!r.draft), [tasksOn, auto]);
}

/**
 * Every button that asks Claude for something goes through this. A draft request with auto drafting on goes to the draft queue and
 * follows its run (writing, then ready); anything else creates Claude's task and shows the toast, and `asked` is true while an open task
 * of Claude's with the same title is on the same record, so a second click cannot create a duplicate.
 */
export function useAskClaude() {
  const tasksOn = useTasksOn();
  const auto = useAutoDraft();
  const open = useOpenTasks(tasksOn).rows;
  const openKeys = useMemo(() => openRequestKeys(open), [open]);
  const runs = useDraftRuns(auto);
  /** requests sent but not yet in the task list or the run list */
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  /** draft requests the server turned into Claude's task (auto drafting could not start) */
  const [tasked, setTasked] = useState<ReadonlySet<string>>(new Set());
  const inflight = useRef(new Set<string>());

  useEffect(() => {
    setSent((cur) => (cur.size && [...cur].some((k) => openKeys.has(k) || runs.has(k)) ? new Set([...cur].filter((k) => !openKeys.has(k) && !runs.has(k))) : cur));
  }, [openKeys, runs]);

  const viaRun = useCallback((r: ClaudeRequest) => auto && !!r.draft, [auto]);

  const state = useCallback((r: ClaudeRequest): AskState => {
    const k = requestKey(r.title, r.target);
    if (viaRun(r)) {
      const last = runs.get(k);
      if (last?.state === "queued" || last?.state === "running") return { kind: "writing", run: last };
      if (last?.state === "done") return { kind: "ready", run: last };
      if (tasked.has(k)) return { kind: "asked" };
      return sent.has(k) ? { kind: "writing" } : { kind: "idle" };
    }
    return sent.has(k) || openKeys.has(k) ? { kind: "asked" } : { kind: "idle" };
  }, [viaRun, runs, sent, tasked, openKeys]);

  const asked = useCallback((r: ClaudeRequest) => state(r).kind !== "idle", [state]);

  const ask = useCallback(async (r: ClaudeRequest) => {
    const k = requestKey(r.title, r.target);
    // a second press before the first render still lands here: the ref sees it at once
    if (inflight.current.has(k) || state(r).kind !== "idle") return false;
    inflight.current.add(k);
    setSent((cur) => new Set(cur).add(k));
    try {
      if (viaRun(r)) {
        const res = await run<never>("post", DRAFT_RUNS_PATH, { title: r.title, ...r.target, channel: r.channel }, { silent: true });
        if (res.mode === "run") putRun(res.run as DraftRun);
        else {
          // auto drafting could not start (no Claude CLI): the server made it Claude's task, as the old path does
          setTasked((cur) => new Set(cur).add(k));
          refreshResource("tasks");
          toast(r.ok);
        }
        return true;
      }
      await run("post", "/tasks", { title: r.title, assignee: "claude", due_date: todayIso(), ...r.target }, { ok: r.ok });
      return true;
    } catch (e) {
      if (viaRun(r)) report(e);
      setSent((cur) => new Set([...cur].filter((x) => x !== k)));
      return false;
    } finally {
      inflight.current.delete(k);
    }
  }, [state, viaRun]);

  return { asked, ask, state };
}
