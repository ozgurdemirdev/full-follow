import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { run } from "../api/actions";
import { useOpenTasks } from "../api/keys";
import { openRequestKeys, requestKey, type ClaudeRequest } from "./claudeRequest";
import { todayIso } from "./format";
import { useTasksOn } from "./taskAccess";

export type { ClaudeRequest, ClaudeTarget } from "./claudeRequest";

/**
 * Every button that asks Claude for something goes through this: `ask` creates the task and shows the toast (an error shows the error
 * toast), `asked` is true while an open task of Claude's with the same title is on the same record, so the button can show
 * its requested state and a second click cannot create a duplicate.
 */
export function useAskClaude() {
  const tasksOn = useTasksOn();
  const open = useOpenTasks(tasksOn).rows;
  const openKeys = useMemo(() => openRequestKeys(open), [open]);
  /** requests sent but not yet in the task list */
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  const inflight = useRef(new Set<string>());

  useEffect(() => {
    setSent((cur) => (cur.size && [...cur].some((k) => openKeys.has(k)) ? new Set([...cur].filter((k) => !openKeys.has(k))) : cur));
  }, [openKeys]);

  const asked = useCallback((r: ClaudeRequest) => {
    const k = requestKey(r.title, r.target);
    return sent.has(k) || openKeys.has(k);
  }, [sent, openKeys]);

  const ask = useCallback(async (r: ClaudeRequest) => {
    const k = requestKey(r.title, r.target);
    // a second press before the first render still lands here: the ref sees it at once
    if (inflight.current.has(k) || sent.has(k) || openKeys.has(k)) return false;
    inflight.current.add(k);
    setSent((cur) => new Set(cur).add(k));
    try {
      await run("post", "/tasks", { title: r.title, assignee: "claude", due_date: todayIso(), ...r.target }, { ok: r.ok });
      return true;
    } catch {
      setSent((cur) => new Set([...cur].filter((x) => x !== k)));
      return false;
    } finally {
      inflight.current.delete(k);
    }
  }, [sent, openKeys]);

  return { asked, ask };
}
