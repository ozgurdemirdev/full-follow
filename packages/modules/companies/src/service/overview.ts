import {
  ALL_ROWS, dayOf, daysBetween, inIds, keptRows, listThreads, LOCALE, page,
  type CompaniesOverview, type CompanyOverviewRow, type CompanyRow, type CompanySegment, type CompanyTotals, type Ctx, type ListOpts,
} from "@fullfollow/core";
import { TILE_PEOPLE } from "./constants";
import { companiesList } from "./list";

type SortKey = "value" | "recent" | "name";

/** What a company is worth on the screen: paid, still due and open (the sort by value and the money bar read it) */
const worth = (c: CompanyRow) => c.money.won + c.money.due + c.money.open;

/** The order the screen offers: most valuable first (default), most recently touched first (untouched last), by name */
function sorter(key: SortKey, today: string): (a: CompanyRow, b: CompanyRow) => number {
  const byValue = (a: CompanyRow, b: CompanyRow) => worth(b) - worth(a);
  const days = (c: CompanyRow) => (c.last_touch_at ? Math.max(0, daysBetween(dayOf(c.last_touch_at), today)) : Infinity);
  if (key === "name") return (a, b) => a.name.localeCompare(b.name, LOCALE);
  if (key === "recent") return (a, b) => (days(a) === days(b) ? 0 : days(a) < days(b) ? -1 : 1) || byValue(a, b);
  return byValue;
}

/** The people, first project and Claude's hint of the companies on one page (three batched reads, whatever the page size) */
function decorate(ctx: Ctx, list: CompanyRow[]): CompanyOverviewRow[] {
  if (!list.length) return [];
  const ids = JSON.stringify(list.map((c) => c.id));
  // the people table is read directly on purpose, like the people count of the list: the screen keeps its tiles without the people module
  const people = keptRows<{ id: number; name: string; company_id: number }>(ctx, `SELECT id, name, company_id FROM people WHERE ${inIds("company_id")}`, ids);
  const net = ctx.mod("network")?.stats();
  const byCompany = new Map<number, CompanyOverviewRow["people"]>();
  for (const p of people) {
    const mine = byCompany.get(p.company_id) ?? [];
    mine.push({ id: p.id, name: p.name, last_touch_at: net?.get(p.id)?.last_touch_at ?? null });
    byCompany.set(p.company_id, mine);
  }
  const money = ctx.mod("projects")?.moneyByCompany();
  const hints = new Map<number, string>();
  // newest thread first: the first one Claude wrote last in is the hint
  for (const t of listThreads(ctx, { target_type: "company", resolved: false, last_by: "claude" })) if (!hints.has(t.target_id)) hints.set(t.target_id, t.last_body);
  return list.map((c) => ({
    ...c,
    people: (byCompany.get(c.id) ?? []).sort((a, b) => (b.last_touch_at ?? "").localeCompare(a.last_touch_at ?? "")).slice(0, TILE_PEOPLE),
    first_project_at: money?.get(c.id)?.first_started ?? null,
    hint: hints.get(c.id) ?? null,
  }));
}

/**
 * The page of the company list the screen shows. The list service filters (tags, sectors, source, status, search) run first;
 * then the screen's own: the segment (after the counts) and the sort.
 */
export function companiesOverview(ctx: Ctx, o: ListOpts): CompaniesOverview {
  const f = o.filter ?? {};
  let list = companiesList(ctx, { q: o.q, filter: f, limit: ALL_ROWS }).rows;

  const counts: CompaniesOverview["counts"] = { all: list.length, client: 0, lead: 0, partner: 0 };
  for (const c of list) counts[c.segment as CompanySegment]++;
  if (f.segment) list = list.filter((c) => c.segment === f.segment);
  list = [...list].sort(sorter((f.sort as SortKey) ?? "value", ctx.clock.today()));

  const { rows, total } = page(list, o.limit, o.offset);
  return { rows: decorate(ctx, rows), total, counts };
}

/** Money and decision makers of the whole company book (see `CompaniesApi.totals`) */
export function companyTotals(ctx: Ctx): CompanyTotals {
  const paid = ctx.mod("projects")?.moneyByCompany();
  const open = ctx.mod("pipeline")?.openByCompany();
  const t: CompanyTotals = { won: 0, due: 0, dueCompanies: 0, open: 0, openCompanies: 0, deciders: 0, unreached: [] };
  for (const m of paid?.values() ?? []) {
    t.won += m.paid;
    t.due += m.due;
    if (m.due > 0) t.dueCompanies++;
  }
  for (const m of open?.values() ?? []) {
    t.open += m.value;
    if (m.value > 0) t.openCompanies++;
  }
  // deciders: read from the people table on purpose (see decorate); a decision maker is "reached" once the network module knows a touch
  const net = ctx.mod("network")?.stats();
  const deciders = keptRows<{ id: number; company_id: number; company: string }>(ctx, `
    SELECT p.id, p.company_id, c.name AS company FROM people p JOIN companies c ON c.id = p.company_id
    WHERE p.influence = 'karar_verici' ORDER BY c.name COLLATE NOCASE`);
  t.deciders = deciders.length;
  const untouched = new Set<number>();
  for (const d of deciders) if (!net?.get(d.id)?.last_touch_at) untouched.add(d.company_id);
  t.unreached = [...new Map(deciders.filter((d) => untouched.has(d.company_id)).map((d) => [d.company_id, d.company])).values()];
  return t;
}
