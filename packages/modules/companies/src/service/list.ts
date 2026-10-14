import { has, labelFields, labelFilter, page, rows, sectorsOf, stripKeys, tagsOf, type CompanyRow, type Ctx, type ListOpts } from "@fullfollow/core";
import { segmentOf } from "./segment";

/**
 * Firma listesi: kişi sayısı, son temas (firmaya ya da çalışanlarına), açık fırsat sayısı. Filtreler: tag, sector, source, status.
 * The open opportunity count and value come from the pipeline module, the money received and due and the segment's projects from the projects module,
 * each in one batched query for the whole list (zeros, and no client segment, without them).
 * TODO(modules): the people and touch counts through ctx.mod("people") / ctx.mod("network") (raw table reads for now)
 */
export function companiesList(ctx: Ctx, o: ListOpts): { rows: CompanyRow[]; total: number } {
  const f = o.filter ?? {};
  const tags = tagsOf(ctx, "company");
  const sectors = sectorsOf(ctx, "company");
  const openOpps = ctx.mod("pipeline")?.openByCompany();
  const projectMoney = ctx.mod("projects")?.moneyByCompany();
  let list: CompanyRow[] = rows(ctx, `
    SELECT c.*, so.name AS source_name,
      (SELECT COUNT(*) FROM people p WHERE p.company_id = c.id) AS people_count,
      (SELECT MAX(t.happened_at) FROM touches t WHERE t.company_id = c.id OR t.person_id IN (SELECT id FROM people WHERE company_id = c.id)) AS last_touch_at,
      (SELECT COUNT(*) FROM touches t WHERE t.company_id = c.id OR t.person_id IN (SELECT id FROM people WHERE company_id = c.id)) AS touch_count
    FROM companies c LEFT JOIN sources so ON so.id = c.source_id ORDER BY c.name COLLATE NOCASE`)
    .map((c) => ({
      ...stripKeys(c), open_opps: openOpps?.get(c.id)?.count ?? 0, ...labelFields(tags.get(c.id), sectors.get(c.id)),
      segment: segmentOf(projectMoney?.get(c.id)?.projects ?? 0, tags.get(c.id)),
      money: { won: projectMoney?.get(c.id)?.paid ?? 0, due: projectMoney?.get(c.id)?.due ?? 0, open: openOpps?.get(c.id)?.value ?? 0 },
    }));
  list = labelFilter(ctx, list, f);
  list = list.filter((c) => has(o.q, c.name, c.website, c.email, c.instagram, c.linkedin, c.sector_path, c.tags.join(" ")));
  return page(list, o.limit, o.offset);
}
