import {
  bool, dayOf, daysBetween, keptRow, page,
  type Ctx, type ListOpts, type PeopleOverview, type PersonRow, type PersonState,
} from "@fullfollow/core";
import { ALL_ROWS, CHANNEL_ACCOUNT, FRESH_DAYS, TOUCH_QUEUE_DEFAULT } from "./constants";
import { peopleList } from "./list";

/** Rank of a state on the people screen (lower first) */
const STATE_RANK: Record<PersonState, number> = { due: 0, wait: 1, cold: 2, fresh: 3, ok: 4 };
const QUEUE_STATES: PersonState[] = ["due", "wait", "cold"];

/** One state per person: a follow-up that came due beats a reply that is awaited, that beats a cooling relation, that beats a new person */
export function stateOf(p: Pick<PersonRow, "next_follow_up_at" | "awaiting" | "cooling" | "created_at">, today: string): PersonState {
  if (p.next_follow_up_at && p.next_follow_up_at <= today) return "due";
  if (p.awaiting) return "wait";
  if (p.cooling) return "cold";
  if (daysBetween(dayOf(p.created_at), today) <= FRESH_DAYS) return "fresh";
  return "ok";
}

/** A comma separated list of ids (`ids=3,7`) as a set; undefined when the filter is not given */
function idSet(v: unknown): Set<number> | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return new Set(String(v).split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0));
}

/**
 * The page of the people list the screen shows. The list service filters (tags, sectors, source, status, search ...) run first;
 * then the screen's own: ids, company_ids, post_ids, has_channel (an account on that channel) and, after the counts, state.
 */
export function peopleOverview(ctx: Ctx, o: ListOpts): PeopleOverview {
  const f = o.filter ?? {};
  const today = ctx.clock.today();
  const ids = idSet(f.ids);
  const companies = idSet(f.company_ids);
  const posts = idSet(f.post_ids);
  const account = f.has_channel ? CHANNEL_ACCOUNT[String(f.has_channel) as keyof typeof CHANNEL_ACCOUNT] : undefined;

  let list = peopleList(ctx, { q: o.q, filter: f, limit: ALL_ROWS }).rows;
  if (ids) list = list.filter((p) => ids.has(p.id));
  if (companies) list = list.filter((p) => p.company_id !== null && companies.has(p.company_id));
  if (posts) list = list.filter((p) => p.post_id !== null && posts.has(p.post_id));
  if (account) list = list.filter((p) => !!p[account]);

  const states = new Map(list.map((p) => [p.id, stateOf(p, today)]));
  const counts: PeopleOverview["counts"] = { all: list.length, due: 0, wait: 0, cold: 0, fresh: 0 };
  for (const s of states.values()) if (s !== "ok") counts[s]++;
  if (f.state) list = list.filter((p) => states.get(p.id) === f.state);
  list = [...list].sort((a, b) => STATE_RANK[states.get(a.id)!] - STATE_RANK[states.get(b.id)!]);

  const { rows, total } = page(list, o.limit, o.offset);
  return { rows, total, counts };
}

/** What the whole book holds, whatever the filters: people, and how many of them are cooling */
export function peopleSummary(ctx: Ctx): { people: number; cooling: number } {
  const people = keptRow<{ n: number }>(ctx, "SELECT COUNT(*) n FROM people")?.n ?? 0;
  const stats = ctx.mod("network")?.stats();
  return { people, cooling: stats ? [...stats.values()].filter((s) => s.cooling).length : 0 };
}

/** Order of the touch cards: by state, then the most overdue first inside a state */
function compareTouch(a: PersonRow, b: PersonRow, states: Map<number, PersonState>): number {
  const sa = states.get(a.id)!;
  const sb = states.get(b.id)!;
  if (sa !== sb) return STATE_RANK[sa] - STATE_RANK[sb];
  if (sa === "due") return (a.next_follow_up_at ?? "").localeCompare(b.next_follow_up_at ?? "");
  if (sa === "wait") return (b.awaiting?.days ?? 0) - (a.awaiting?.days ?? 0);
  return b.days_since - a.days_since;
}

/** The people to reach out to first (see `PeopleApi.touchQueue`) */
export function touchQueue(ctx: Ctx, o: { limit?: number; exclude?: number[]; all?: boolean }): PersonRow[] {
  const today = ctx.clock.today();
  const skip = new Set(o.exclude ?? []);
  const states = new Map<number, PersonState>();
  const list = peopleList(ctx, { limit: ALL_ROWS }).rows.filter((p) => {
    if (skip.has(p.id)) return false;
    const s = stateOf(p, today);
    states.set(p.id, s);
    return bool(o.all) || QUEUE_STATES.includes(s);
  });
  return list.sort((a, b) => compareTouch(a, b, states)).slice(0, o.limit ?? TOUCH_QUEUE_DEFAULT);
}
