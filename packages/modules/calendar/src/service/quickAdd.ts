import type { TaskKind } from "@fullfollow/core";
import { DEFAULT_TASK_KIND, TASK_KIND_KEYWORDS } from "./constants";

/** A leading or trailing time: "14:00", "9.30" (hour 0 to 23, minutes two digits) */
const LEADING_TIME = /^\s*([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s+|$)/;
const TRAILING_TIME = /(?:^|\s+)([01]?\d|2[0-3])[:.]([0-5]\d)\s*$/;

export interface QuickTask {
  title: string;
  /** "HH:MM" or null */
  due_time: string | null;
  kind: TaskKind;
}

const hhmm = (h: string, m: string) => `${h.padStart(2, "0")}:${m}`;

/** Kind of a task from its words (first matching keyword group wins, else the default kind) */
export function taskKindOf(text: string): TaskKind {
  const lower = text.toLocaleLowerCase("tr");
  return TASK_KIND_KEYWORDS.find((k) => k.words.some((w) => lower.includes(w)))?.kind ?? DEFAULT_TASK_KIND;
}

/** Free text of the calendar quick add ("14:00 Elif ile görüşme") to a task: time taken off the text, kind from the keywords */
export function parseQuickTask(text: string): QuickTask {
  const raw = text.trim();
  const lead = LEADING_TIME.exec(raw);
  const trail = lead ? null : TRAILING_TIME.exec(raw);
  const hit = lead ?? trail;
  const title = (lead ? raw.slice(lead[0].length) : trail ? raw.slice(0, trail.index) : raw).trim();
  return { title: title || raw, due_time: hit ? hhmm(hit[1], hit[2]) : null, kind: taskKindOf(title || raw) };
}
