import { has, keptRows, OWN_PROJECT_STATUSES, page, sectorMatch, type Ctx, type ListOpts, type OwnProjectStats } from "@fullfollow/core";
import { NEXT_STEP_PRIORITY } from "./constants";

/** One person's reaction across the ideas of every project: interested in at least one idea, answered (interested or not) on at least one */
function interestByProject(ctx: Ctx) {
  const by = new Map<number, { told: number; interested: number; answered: number }>();
  for (const p of keptRows<{ own_project_id: number; yes: number; answered: number }>(ctx, `
    SELECT i.own_project_id, MAX(x.interest = 'ilgilendi') AS yes, MAX(x.interest IN ('ilgilendi', 'ilgilenmedi')) AS answered
    FROM idea_people x JOIN ideas i ON i.id = x.idea_id WHERE i.own_project_id IS NOT NULL GROUP BY i.own_project_id, x.person_id`)) {
    const c = by.get(p.own_project_id) ?? { told: 0, interested: 0, answered: 0 };
    c.told++; c.interested += p.yes; c.answered += p.answered;
    by.set(p.own_project_id, c);
  }
  return by;
}

/**
 * Own products list with open/done idea counts and sectors, grouped by status.
 * The ideas table is read directly for the counts: it always exists.
 */
export function ownProjectStats(ctx: Ctx): OwnProjectStats[] {
  const secs = keptRows<{ own_project_id: number; id: number; path: string }>(ctx, `
    SELECT x.own_project_id, s.id, CASE WHEN p.name IS NULL THEN s.name ELSE p.name || ' > ' || s.name END AS path
    FROM own_project_sectors x JOIN sectors s ON s.id = x.sector_id LEFT JOIN sectors p ON p.id = s.parent_id ORDER BY path`);
  const interest = interestByProject(ctx);
  const tops = keptRows<{ own_project_id: number; id: number; title: string }>(ctx,
    "SELECT own_project_id, id, title FROM ideas WHERE own_project_id IS NOT NULL AND done_at IS NULL AND priority = ? ORDER BY position, id", NEXT_STEP_PRIORITY);
  return keptRows(ctx, `
    SELECT o.*,
      (SELECT COUNT(*) FROM ideas i WHERE i.own_project_id = o.id AND i.done_at IS NULL) AS open_ideas,
      (SELECT COUNT(*) FROM ideas i WHERE i.own_project_id = o.id AND i.done_at IS NOT NULL) AS done_ideas
    FROM own_projects o`)
    .map((o): OwnProjectStats => {
      const { told, interested, answered } = interest.get(o.id) ?? { told: 0, interested: 0, answered: 0 };
      const top_ideas = tops.filter((t) => t.own_project_id === o.id).map((t) => ({ id: t.id, title: t.title }));
      return {
        ...o, sectors: secs.filter((x) => x.own_project_id === o.id).map((x) => ({ id: x.id, path: x.path })),
        told, interested, answered, interest_share: answered ? interested / answered : null, top_ideas, next_idea: top_ideas[0] ?? null,
      };
    })
    .sort((a, b) => OWN_PROJECT_STATUSES.indexOf(a.status) - OWN_PROJECT_STATUSES.indexOf(b.status) || b.updated_at.localeCompare(a.updated_at));
}

/** Filters: status and sellable (comma separated lists), sector (the sector and its sub sectors); q searches name, description and notes */
export function ownProjectList(ctx: Ctx, o: ListOpts): { rows: OwnProjectStats[]; total: number } {
  const f = o.filter ?? {};
  let list = ownProjectStats(ctx);
  for (const k of ["status", "sellable"] as const) {
    if (f[k]) { const want = String(f[k]).split(",").map((x) => x.trim()); list = list.filter((p) => want.includes(p[k])); }
  }
  if (f.sector) {
    const ids = sectorMatch(ctx, f.sector);
    list = list.filter((p) => p.sectors.some((s) => ids.includes(s.id)));
  }
  list = list.filter((p) => has(o.q, p.name, p.description, p.notes));
  return page(list, o.limit, o.offset);
}

export const ownProjectGet = (ctx: Ctx, id: number): OwnProjectStats | undefined => ownProjectStats(ctx).find((p) => p.id === id);
