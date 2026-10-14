import { has, labelFields, labelFilter, page, rows, sectorsOf, stripKeys, tagsOf, type CompanyRow, type Ctx, type ListOpts } from "@fullfollow/core";

/**
 * Firma listesi: kişi sayısı, son temas (firmaya ya da çalışanlarına), açık fırsat sayısı. Filtreler: tag, sector, source, status.
 * The open opportunity count comes from the pipeline module (0 without it).
 * The people and touch counts read those tables directly on purpose: tables always exist, so the list keeps its numbers without those modules.
 */
export function companiesList(ctx: Ctx, o: ListOpts): { rows: CompanyRow[]; total: number } {
  const f = o.filter ?? {};
  const tags = tagsOf(ctx, "company");
  const sectors = sectorsOf(ctx, "company");
  const openOpps = ctx.mod("pipeline")?.openCountsByCompany();
  let list: CompanyRow[] = rows(ctx, `
    SELECT c.*, so.name AS source_name,
      (SELECT COUNT(*) FROM people p WHERE p.company_id = c.id) AS people_count,
      (SELECT MAX(t.happened_at) FROM touches t WHERE t.company_id = c.id OR t.person_id IN (SELECT id FROM people WHERE company_id = c.id)) AS last_touch_at,
      (SELECT COUNT(*) FROM touches t WHERE t.company_id = c.id OR t.person_id IN (SELECT id FROM people WHERE company_id = c.id)) AS touch_count
    FROM companies c LEFT JOIN sources so ON so.id = c.source_id ORDER BY c.name COLLATE NOCASE`)
    .map((c) => ({ ...stripKeys(c), open_opps: openOpps?.get(c.id) ?? 0, ...labelFields(tags.get(c.id), sectors.get(c.id)) }));
  list = labelFilter(ctx, list, f);
  list = list.filter((c) => has(o.q, c.name, c.website, c.email, c.instagram, c.linkedin, c.sector_path, c.tags.join(" ")));
  return page(list, o.limit, o.offset);
}
