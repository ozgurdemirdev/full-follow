import { addDays, FFError, isIsoDate, keptRow, keptRows, weekStart, type Ctx, type TimelineEventDef, type WeekStrip } from "@fullfollow/core";
import { DRAFT_APPROVED_STATUSES, WEEK_DAYS } from "../constants";
import { m } from "../messages";

/** Events of the feed types in a range, counted per type and actor; the `events_feed` index serves the range */
const COUNTS = `SELECT e.type, e.created_by, COUNT(*) AS n FROM events e
  WHERE e.type IN (SELECT value FROM json_each(?)) AND e.created_at >= ? AND e.created_at < ? GROUP BY e.type, e.created_by`;

/** Claude's drafts of a range that are approved or sent: the draft row is the one the event points at */
const approvedDrafts = (table: string) => `SELECT COUNT(*) AS n FROM events e WHERE e.type = ? AND e.created_by = 'claude' AND e.created_at >= ? AND e.created_at < ?
  AND json_extract(e.data, ?) IN (SELECT id FROM ${table} WHERE status IN (SELECT value FROM json_each(?)))`;

type Counted = { type: string; created_by: string; n: number }[];

/** Local midnight of a date as the UTC time events are stamped with (a week of the screen is a local week) */
const dayStart = (date: string) => new Date(`${date}T00:00:00`).toISOString().replace(/\.\d{3}Z$/, "Z");

/** The week strip: Monday to Sunday of the week `start` falls in, against the week before */
export function weekOf(ctx: Ctx, kinds: Record<string, TimelineEventDef>, start?: string): WeekStrip {
  if (start !== undefined && !isIsoDate(start)) throw new FFError("validation", m.badStart);
  const monday = weekStart(start ?? ctx.clock.today());
  const types = JSON.stringify(Object.keys(kinds));
  const from = dayStart(monday);
  const to = dayStart(addDays(monday, WEEK_DAYS));
  const count = (a: string, b: string) => keptRows<Counted[number]>(ctx, COUNTS, types, a, b);
  const total = (list: Counted, pick: (type: string, by: string) => boolean) => list.filter((r) => pick(r.type, r.created_by)).reduce((sum, r) => sum + r.n, 0);
  const kind = (type: string) => kinds[type].kind;

  const now = count(from, to);
  const before = count(dayStart(addDays(monday, -WEEK_DAYS)), from);
  // the money received is the projects module's ledger by payment date, the same figure the reports show (null without the module)
  const collected = ctx.mod("projects")?.collectedBetween(monday, addDays(monday, WEEK_DAYS - 1)) ?? null;
  const approved = Object.entries(kinds).filter(([, d]) => d.kind === "taslak" && d.row)
    .reduce((sum, [type, d]) => sum + (keptRow<{ n: number }>(ctx, approvedDrafts(d.row!.table), type, from, to, `$.${d.row!.key}`, JSON.stringify(DRAFT_APPROVED_STATUSES))?.n ?? 0), 0);
  return {
    start: monday,
    me: total(now, (_t, by) => by === "owner"),
    claude: total(now, (_t, by) => by === "claude"),
    touches: total(now, (t) => kind(t) === "temas"),
    collections_amount: collected,
    collections_count: total(now, (t) => kind(t) === "odeme"),
    tasks_done: total(now, (t) => kind(t) === "gorev"),
    claude_drafts: total(now, (t, by) => kind(t) === "taslak" && by === "claude"),
    claude_drafts_approved: approved,
    prev: { touches: total(before, (t) => kind(t) === "temas"), tasks_done: total(before, (t) => kind(t) === "gorev") },
  };
}
