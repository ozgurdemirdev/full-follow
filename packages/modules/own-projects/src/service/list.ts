import { has, keptRows, OWN_PROJECT_STATUSES, page, sectorMatch, type Ctx, type ListOpts, type OwnProjectStats } from "@fullfollow/core";

/**
 * Own products list with open/done idea counts and sectors, grouped by status.
 * The ideas table is read directly for the counts: it always exists.
 */
export function ownProjectStats(ctx: Ctx): OwnProjectStats[] {
  const secs = keptRows<{ own_project_id: number; id: number; path: string }>(ctx, `
    SELECT x.own_project_id, s.id, CASE WHEN p.name IS NULL THEN s.name ELSE p.name || ' > ' || s.name END AS path
    FROM own_project_sectors x JOIN sectors s ON s.id = x.sector_id LEFT JOIN sectors p ON p.id = s.parent_id ORDER BY path`);
  return keptRows(ctx, `
    SELECT o.*,
      (SELECT COUNT(*) FROM ideas i WHERE i.own_project_id = o.id AND i.done_at IS NULL) AS open_ideas,
      (SELECT COUNT(*) FROM ideas i WHERE i.own_project_id = o.id AND i.done_at IS NOT NULL) AS done_ideas
    FROM own_projects o`)
    .map((o): OwnProjectStats => ({ ...o, sectors: secs.filter((x) => x.own_project_id === o.id).map((x) => ({ id: x.id, path: x.path })) }))
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
