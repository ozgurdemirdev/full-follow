import { has, labelFields, labelFilter, page, rows, sectorsOf, stripKeys, tagsOf, type CompanyRow, type Ctx, type ListOpts } from "@fullfollow/core";

/**
 * Firma listesi: kişi sayısı, son temas (firmaya ya da çalışanlarına), açık fırsat sayısı. Filtreler: tag, sector, source, status.
 * TODO(modules): the people, touch and opportunity counts through ctx.mod("people") / ctx.mod("network") / ctx.mod("pipeline") (raw table reads for now)
 */
export function companiesList(ctx: Ctx, o: ListOpts): { rows: CompanyRow[]; total: number } {
  const f = o.filter ?? {};
  const tags = tagsOf(ctx, "company");
  const sectors = sectorsOf(ctx, "company");
  let list: CompanyRow[] = rows(ctx, `
    SELECT c.*, so.name AS source_name,
      (SELECT COUNT(*) FROM people p WHERE p.company_id = c.id) AS people_count,
      (SELECT MAX(t.happened_at) FROM touches t WHERE t.company_id = c.id OR t.person_id IN (SELECT id FROM people WHERE company_id = c.id)) AS last_touch_at,
      (SELECT COUNT(*) FROM touches t WHERE t.company_id = c.id OR t.person_id IN (SELECT id FROM people WHERE company_id = c.id)) AS touch_count,
      (SELECT COUNT(*) FROM opportunities x JOIN people p ON p.id = x.person_id WHERE p.company_id = c.id AND x.stage IN ('bulundu','temas','cevap','gorusme','teklif')) AS open_opps
    FROM companies c LEFT JOIN sources so ON so.id = c.source_id ORDER BY c.name COLLATE NOCASE`)
    .map((c) => ({ ...stripKeys(c), ...labelFields(tags.get(c.id), sectors.get(c.id)) }));
  list = labelFilter(ctx, list, f);
  list = list.filter((c) => has(o.q, c.name, c.website, c.email, c.instagram, c.linkedin, c.sector_path, c.tags.join(" ")));
  return page(list, o.limit, o.offset);
}
