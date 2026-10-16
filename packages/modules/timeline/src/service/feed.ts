import { keptRow, keptRows, parse, type Actor, type Ctx, type DayCount, type FeedPage, type FeedQuery, type FeedRecord, type FeedRow, type TimelineEventDef } from "@fullfollow/core";
import { cursorOf, decodeCursor, feedQuery, kindsOf, recordOf } from "./schemas";

const DAY_MS = 86_400_000;

interface EventRow {
  id: number;
  day: string;
  type: string;
  summary: string;
  data: string | null;
  person_id: number | null;
  opportunity_id: number | null;
  project_id: number | null;
  created_by: Actor;
  created_at: string;
}
interface Links {
  person_id: number | null;
  company_id: number | null;
  opportunity_id: number | null;
  project_id: number | null;
}

/** The newest events of the feed types, keyset on (created_at, id): the `events_feed` index serves both the order and the cursor range */
const WHERE = `FROM events e WHERE e.type IN (SELECT value FROM json_each(?)) AND (? IS NULL OR e.created_by = ?) AND (? IS NULL OR e.summary LIKE ? ESCAPE '\\'
  OR e.person_id IN (SELECT id FROM people WHERE name LIKE ? ESCAPE '\\') OR e.opportunity_id IN (SELECT id FROM opportunities WHERE title LIKE ? ESCAPE '\\')
  OR e.project_id IN (SELECT id FROM projects WHERE name LIKE ? ESCAPE '\\'))`;
const SELECT = `SELECT e.id, e.type, e.summary, e.data, e.person_id, e.opportunity_id, e.project_id, e.created_by, e.created_at, date(e.created_at, 'localtime') AS day ${WHERE}`;
const COUNT = `SELECT COUNT(*) AS n ${WHERE}`;
const SINCE = " AND e.created_at >= ?";
const CURSOR = " AND e.created_at <= ? AND (e.created_at < ? OR e.id < ?)";
const ORDER = " ORDER BY e.created_at DESC, e.id DESC LIMIT ?";
/** Events of the feed types per local day and actor in a time range (the day headers count every row of the day, whatever the filters) */
const DAYS = `SELECT date(e.created_at, 'localtime') AS day, e.created_by AS actor, COUNT(*) AS n FROM events e
  WHERE e.type IN (SELECT value FROM json_each(?)) AND e.created_at >= ? AND e.created_at < ? GROUP BY day, actor`;

/** The event column that links a record kind, and the column the rows events point at carry for it */
const EVENT_LINK: Record<string, string> = { person: "person_id", opportunity: "opportunity_id", project: "project_id" };
const ROW_LINK: Record<string, string> = { ...EVENT_LINK, company: "company_id" };

const NAMES = {
  project: "SELECT id, name FROM projects WHERE id IN (SELECT value FROM json_each(?))",
  opportunity: "SELECT id, title AS name FROM opportunities WHERE id IN (SELECT value FROM json_each(?))",
  person: "SELECT id, name FROM people WHERE id IN (SELECT value FROM json_each(?))",
  company: "SELECT id, name FROM companies WHERE id IN (SELECT value FROM json_each(?))",
} as const;
const COMMENTS = "SELECT id, target_type, target_id FROM comments WHERE id IN (SELECT value FROM json_each(?))";

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const idList = (list: (number | null | undefined)[]) => JSON.stringify([...new Set(list.filter((x): x is number => typeof x === "number"))]);
const numberOf = (v: unknown) => (typeof v === "number" ? v : null);

/** The part of the query that keeps the events of one record: its own links, the rows its events point at, and comments on it */
function recordClause(kinds: Record<string, TimelineEventDef>, record: { kind: string; id: number }) {
  const parts: string[] = [];
  const params: unknown[] = [];
  const own = EVENT_LINK[record.kind];
  if (own) {
    parts.push(`e.${own} = ?`);
    params.push(record.id);
  }
  for (const [type, def] of Object.entries(kinds)) {
    if (def.row && ROW_LINK[record.kind]) {
      parts.push(`(e.type = ? AND json_extract(e.data, ?) IN (SELECT id FROM ${def.row.table} WHERE ${ROW_LINK[record.kind]} = ?))`);
      params.push(type, `$.${def.row.key}`, record.id);
    }
    if (def.kind === "yorum") {
      parts.push("(e.type = ? AND json_extract(e.data, '$.comment_id') IN (SELECT id FROM comments WHERE target_type = ? AND target_id = ?))");
      params.push(type, record.kind, record.id);
    }
  }
  return { sql: ` AND (${parts.join(" OR ")})`, params };
}

/** Events per actor of the local days the page falls on, counted over the days whole */
function dayCounts(ctx: Ctx, kinds: Record<string, TimelineEventDef>, page: EventRow[]): Record<string, DayCount> {
  if (!page.length) return {};
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  const from = iso(Date.parse(page[page.length - 1].created_at) - DAY_MS);
  const to = iso(Date.parse(page[0].created_at) + DAY_MS);
  const shown = new Set(page.map((e) => e.day));
  const counts: Record<string, DayCount> = Object.fromEntries([...shown].map((d) => [d, { owner: 0, claude: 0 }]));
  for (const r of keptRows<{ day: string; actor: Actor; n: number }>(ctx, DAYS, JSON.stringify(Object.keys(kinds)), from, to)) {
    if (shown.has(r.day)) counts[r.day][r.actor] = r.n;
  }
  return counts;
}

/** The global feed: events of the types the modules listed, newest first, as rows with their record chip */
export function feedOf(ctx: Ctx, kinds: Record<string, TimelineEventDef>, input: FeedQuery = {}): FeedPage {
  const q = parse(feedQuery, input);
  const wanted = kindsOf(q.type);
  const types = Object.keys(kinds).filter((t) => !wanted || wanted.includes(kinds[t].kind));
  const cursor = q.before ? decodeCursor(q.before) : null;
  const like = q.q ? `%${escapeLike(q.q)}%` : null;
  const record = q.record ? recordClause(kinds, recordOf(q.record)) : null;
  const filters = [JSON.stringify(types), q.actor ?? null, q.actor ?? null, like, like, like, like, like, ...(record?.params ?? []), ...(q.since ? [q.since] : [])];
  const scope = `${record?.sql ?? ""}${q.since ? SINCE : ""}`;
  const list = keptRows<EventRow>(ctx, `${SELECT}${scope}${cursor ? CURSOR : ""}${ORDER}`, ...filters, ...(cursor ? [cursor.at, cursor.at, cursor.id] : []), q.limit + 1);
  const page = list.slice(0, q.limit);
  const last = page[page.length - 1];
  return {
    rows: feedRows(ctx, kinds, page),
    next_before: list.length > q.limit && last ? cursorOf(last) : null,
    day_counts: dayCounts(ctx, kinds, page),
    ...(record ? { total: keptRow<{ n: number }>(ctx, `${COUNT}${scope}`, ...filters)?.n ?? 0 } : {}),
  };
}

/** Rows for a page of events: links filled from the rows the events point at, names looked up once per kind of record */
function feedRows(ctx: Ctx, kinds: Record<string, TimelineEventDef>, events: EventRow[]): FeedRow[] {
  const data = events.map((e) => (e.data ? (JSON.parse(e.data) as Record<string, unknown>) : {}));
  const links: Links[] = events.map((e) => ({ person_id: e.person_id, company_id: null, opportunity_id: e.opportunity_id, project_id: e.project_id }));

  // the row an event points at (a touch, a draft) carries the links the event itself does not
  const pointers = new Map<string, number[]>();
  events.forEach((e, i) => {
    const def = kinds[e.type].row;
    const id = def && numberOf(data[i][def.key]);
    if (def && id) pointers.set(def.table, [...(pointers.get(def.table) ?? []), id]);
  });
  const pointed = new Map<string, Map<number, Links>>();
  for (const [table, list] of pointers) {
    const found = keptRows<Links & { id: number }>(ctx, `SELECT id, person_id, company_id, opportunity_id, project_id FROM ${table} WHERE id IN (SELECT value FROM json_each(?))`, idList(list));
    pointed.set(table, new Map(found.map((r) => [r.id, r])));
  }
  events.forEach((e, i) => {
    const def = kinds[e.type].row;
    const row = def && pointed.get(def.table)?.get(numberOf(data[i][def.key]) ?? 0);
    if (!row) return;
    const l = links[i];
    l.person_id ??= row.person_id;
    l.company_id ??= row.company_id;
    l.opportunity_id ??= row.opportunity_id;
    l.project_id ??= row.project_id;
  });

  // a comment hangs on a record of any module: the chip is that record
  const commentIds = events.flatMap((e, i) => (kinds[e.type].kind === "yorum" ? [numberOf(data[i].comment_id)] : []));
  const comments = new Map(keptRows<{ id: number; target_type: string; target_id: number }>(ctx, COMMENTS, idList(commentIds)).map((c) => [c.id, c]));

  const names = Object.fromEntries((Object.keys(NAMES) as (keyof typeof NAMES)[]).map((kind) => {
    const wantedIds = idList(links.map((l) => l[`${kind}_id`]));
    return [kind, new Map(wantedIds === "[]" ? [] : keptRows<{ id: number; name: string }>(ctx, NAMES[kind], wantedIds).map((r) => [r.id, r.name]))];
  })) as Record<keyof typeof NAMES, Map<number, string>>;

  return events.map((e, i): FeedRow => {
    const def = kinds[e.type];
    const l = links[i];
    const comment = def.kind === "yorum" ? comments.get(numberOf(data[i].comment_id) ?? 0) : undefined;
    const commented: FeedRecord | null = comment
      ? { kind: comment.target_type, id: comment.target_id, name: ctx.types.commentTarget(comment.target_type)?.label(ctx, comment.target_id) ?? `#${comment.target_id}` }
      : null;
    const chip = (kind: keyof typeof NAMES): FeedRecord | null => {
      const id = l[`${kind}_id`];
      const name = id ? names[kind].get(id) : undefined;
      return id && name ? { kind, id, name } : null;
    };
    const amount = def.amount ? numberOf(data[i][def.amount]) : null;
    return {
      id: e.id, type: def.kind, created_by: e.created_by, created_at: e.created_at, day: e.day, text: e.summary,
      ...(amount === null ? {} : { amount }),
      ...(l.person_id ? { person_id: l.person_id } : {}), ...(l.company_id ? { company_id: l.company_id } : {}),
      ...(l.opportunity_id ? { opportunity_id: l.opportunity_id } : {}), ...(l.project_id ? { project_id: l.project_id } : {}),
      rec: commented ?? chip("project") ?? chip("opportunity") ?? chip("person") ?? chip("company"),
    };
  });
}
