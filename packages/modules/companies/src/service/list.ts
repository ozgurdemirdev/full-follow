import { has, idsOf, inIds, keptRows, labelFields, labelFilter, page, rows, sectorsOf, stripKeys, tagsOf, type CompanyRow, type Ctx, type ListOpts } from "@fullfollow/core";
import { segmentOf } from "./segment";

/**
 * Firma listesi: kişi sayısı, son temas (firmaya ya da çalışanlarına), açık fırsat sayısı. Filtreler: ids, tag, sector, source, status. `ids` narrows in SQL and the tags and sectors are read only for those companies.
 * The open opportunity count and value come from the pipeline module, the money received and due and the segment's projects from the projects module,
 * each in one batched query for the whole list (zeros, and no client segment, without them).
 * The people and touch counts read those tables directly on purpose: tables always exist, so the list keeps its numbers without those modules.
 */
export function companiesList(ctx: Ctx, o: ListOpts): { rows: CompanyRow[]; total: number } {
  const f = o.filter ?? {};
  const ids = idsOf(f);
  const tags = tagsOf(ctx, "company", ids);
  const sectors = sectorsOf(ctx, "company", ids);
  const openOpps = ctx.mod("pipeline")?.openByCompany();
  const projectMoney = ctx.mod("projects")?.moneyByCompany();
  let list: CompanyRow[] = rows(ctx, `
    SELECT c.*, so.name AS source_name,
      (SELECT COUNT(*) FROM people p WHERE p.company_id = c.id) AS people_count,
      (SELECT MAX(t.happened_at) FROM touches t WHERE t.company_id = c.id OR t.person_id IN (SELECT id FROM people WHERE company_id = c.id)) AS last_touch_at,
      (SELECT COUNT(*) FROM touches t WHERE t.company_id = c.id OR t.person_id IN (SELECT id FROM people WHERE company_id = c.id)) AS touch_count
    FROM companies c LEFT JOIN sources so ON so.id = c.source_id ${ids ? `WHERE ${inIds("c.id")}` : ""} ORDER BY c.name COLLATE NOCASE`, ...(ids ? [JSON.stringify(ids)] : []))
    .map((c) => ({
      ...stripKeys(c), open_opps: openOpps?.get(c.id)?.count ?? 0, ...labelFields(tags.get(c.id), sectors.get(c.id)),
      segment: segmentOf(projectMoney?.get(c.id)?.projects ?? 0, tags.get(c.id)),
      money: { won: projectMoney?.get(c.id)?.paid ?? 0, due: projectMoney?.get(c.id)?.due ?? 0, open: openOpps?.get(c.id)?.value ?? 0 },
    }));
  list = labelFilter(ctx, list, f);
  list = list.filter((c) => has(o.q, c.name, c.website, c.email, c.instagram, c.linkedin, c.sector_path, c.tags.join(" ")));
  return page(list, o.limit, o.offset);
}

/** Names of these companies in one statement (the lists of other modules show them) */
export const companyNames = (ctx: Ctx, ids: number[]): Map<number, string> =>
  new Map(ids.length ? keptRows<{ id: number; name: string }>(ctx, `SELECT id, name FROM companies WHERE ${inIds("id")}`, JSON.stringify(ids)).map((r) => [r.id, r.name]) : []);
