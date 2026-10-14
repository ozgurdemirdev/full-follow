import {
  addDays, bool, has, keptRow, keptRows, OPEN_OPP_STAGES, OPP_STAGES, page, rows,
  type Ctx, type ListOpts, type OfferRecord, type OpportunityRef, type OpportunityRow,
} from "@fullfollow/core";

const OPEN = OPEN_OPP_STAGES as readonly string[];
/** The open stages as an SQL list (a constant of the code, so the statements that use it stay literal) */
export const OPEN_SQL = OPEN_OPP_STAGES.map((s) => `'${s}'`).join(",");

const SELECT = `
  SELECT x.*, p.name AS person_name, p.company_id, c.name AS company_name, s.name AS source_name
  FROM opportunities x JOIN people p ON p.id = x.person_id LEFT JOIN companies c ON c.id = p.company_id JOIN sources s ON s.id = x.source_id`;

type Listed = Omit<OpportunityRow, "project_id">;

/** The project each listed opportunity became (null when it has none or the projects module is not installed) */
function withProjects(ctx: Ctx, list: Listed[]): OpportunityRow[] {
  const projects = list.length ? ctx.mod("projects")?.projects.idsForOpportunities(list.map((x) => x.id)) : undefined;
  return list.map((x) => ({ ...x, project_id: projects?.get(x.id) ?? null }));
}

/**
 * Opportunity list. Filters: stage, person_id, source_id, company_id, open, due (follow-up date reached), board (open ones and those closed in the last 30 days).
 * Sorted by stage, then by position in the stage column.
 */
export function opportunityList(ctx: Ctx, o: ListOpts): { rows: OpportunityRow[]; total: number } {
  const f = o.filter ?? {};
  const today = ctx.clock.today();
  let list = rows<Listed>(ctx, SELECT);
  if (f.stage) list = list.filter((x) => x.stage === f.stage);
  if (f.person_id) list = list.filter((x) => x.person_id === Number(f.person_id));
  if (f.source_id) list = list.filter((x) => x.source_id === Number(f.source_id));
  if (bool(f.open)) list = list.filter((x) => OPEN.includes(x.stage));
  if (bool(f.due)) list = list.filter((x) => x.next_follow_up_at && x.next_follow_up_at <= today && OPEN.includes(x.stage));
  if (bool(f.board)) {
    const since = addDays(today, -30);
    list = list.filter((x) => OPEN.includes(x.stage) || (x.closed_at && x.closed_at.slice(0, 10) >= since));
  }
  if (f.company_id) list = list.filter((x) => x.company_id === Number(f.company_id));
  list = list.filter((x) => has(o.q, x.title, x.person_name, x.company_name, x.source_name, x.source_url));
  list.sort((a, b) => OPP_STAGES.indexOf(a.stage) - OPP_STAGES.indexOf(b.stage) || a.position - b.position || a.id - b.id);
  const sliced = page(list, o.limit, o.offset);
  return { rows: withProjects(ctx, sliced.rows), total: sliced.total };
}

/** One opportunity as listed, without loading the rest */
export function opportunityGet(ctx: Ctx, id: number): OpportunityRow | undefined {
  return withProjects(ctx, rows<Listed>(ctx, `${SELECT} WHERE x.id = ?`, id))[0];
}

export const opportunityRef = (ctx: Ctx, id: number): OpportunityRef | undefined =>
  keptRow<OpportunityRef>(ctx, "SELECT id, title, person_id FROM opportunities WHERE id = ?", id);

export const titlesOf = (ctx: Ctx, ids: number[]): Map<number, string> =>
  new Map(ids.length ? keptRows<{ id: number; title: string }>(ctx, "SELECT id, title FROM opportunities WHERE id IN (SELECT value FROM json_each(?))", JSON.stringify(ids)).map((r) => [r.id, r.title]) : []);

export const openIdsOf = (ctx: Ctx, personId: number): number[] =>
  keptRows<{ id: number }>(ctx, `SELECT id FROM opportunities WHERE person_id = ? AND stage IN (${OPEN_SQL})`, personId).map((r) => r.id);

export const countOf = (ctx: Ctx, personId: number): number =>
  keptRow<{ n: number }>(ctx, "SELECT COUNT(*) n FROM opportunities WHERE person_id = ?", personId)?.n ?? 0;

const OFFER_SELECT = "SELECT x.*, op.title AS opportunity_title FROM offers x JOIN opportunities op ON op.id = x.opportunity_id";
type OfferListRow = OfferRecord & { opportunity_title: string };
const parseItems = (r: Omit<OfferListRow, "items"> & { items: string }): OfferListRow => ({ ...r, items: JSON.parse(r.items) });

/** Offer versions, newest first inside an opportunity; filter: {opportunity_id} */
export function offerList(ctx: Ctx, o: ListOpts): { rows: OfferListRow[]; total: number } {
  const f = o.filter ?? {};
  let list = rows(ctx, `${OFFER_SELECT} ORDER BY x.opportunity_id, x.version DESC`).map(parseItems);
  if (f.opportunity_id) list = list.filter((r) => r.opportunity_id === Number(f.opportunity_id));
  list = list.filter((r) => has(o.q, r.opportunity_title, r.note));
  return page(list, o.limit, o.offset);
}

export const offerGet = (ctx: Ctx, id: number): OfferListRow | undefined => rows(ctx, `${OFFER_SELECT} WHERE x.id = ?`, id).map(parseItems)[0];
