import type { TaskAssignee, TaskKind } from "@fullfollow/core";

/** Task kinds (payments and follow-ups are derived kinds of the calendar feed, not task kinds) */
export const TASK_KINDS = ["gorusme", "takip", "gorev"] as const satisfies readonly TaskKind[];
export const DEFAULT_TASK_KIND: TaskKind = "gorev";
/** Who a task can be given to: Özgür, Claude, or the client (a task the client owes, such as an approval or material) */
export const TASK_ASSIGNEES = ["ozgur", "claude", "musteri"] as const satisfies readonly TaskAssignee[];
/** Words that make a quick added task a meeting or a follow-up (lower case, matched inside the text); the first matching kind wins */
export const TASK_KIND_KEYWORDS: readonly { kind: TaskKind; words: readonly string[] }[] = [
  { kind: "gorusme", words: ["görüşme", "toplantı", "call", "arama"] },
  { kind: "takip", words: ["takip", "dönüş"] },
];
/** Hafta günleri ISO numarasıyla (1 = pazartesi); hedef tekrarı bu numaraların virgüllü listesidir */
export const GOAL_DAY_PRESETS = { her_gun: [1, 2, 3, 4, 5, 6, 7], hafta_ici: [1, 2, 3, 4, 5], hafta_sonu: [6, 7] } as const;
/** What a goal counts by itself besides a channel: new people and companies created that day (deleted ones are gone from the tables) */
export const GOAL_METRICS = ["new_records"] as const;
/** Longest calendar range in one call (about three months) */
export const MAX_CALENDAR_DAYS = 92;
/** How far back the streak looks */
export const STREAK_LOOKBACK_DAYS = 365;
/** Task order inside a day: timed ones by time, the rest after them */
export const TASK_ORDER_SQL = "(due_time IS NULL), due_time, id";
/** A time of day: "HH:MM", 00:00 to 23:59 */
export const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
/** A list limit that means "all rows" */
export const ALL_ROWS = 100000;
/** Names the generic tools accept for the task record type (matched against what a person types, with and without the accent) */
export const TASK_ALIASES = ["gorev", "görev"];
/** Characters of a task or goal title kept in an event summary */
export const EVENT_TITLE_CHARS = 60;
/** Characters of a goal title kept in the progress event summary */
export const PROGRESS_TITLE_CHARS = 40;
/** Characters of a goal's note kept in the MCP plan line, the MCP goal line and the MCP log line */
export const PLAN_NOTE_CHARS = 50;
export const GOAL_NOTE_CHARS = 40;
export const LOG_NOTE_CHARS = 50;
