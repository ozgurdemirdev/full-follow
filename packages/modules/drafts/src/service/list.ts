import { bool, has, keptRow, keptRows, page, rows, type Ctx, type DraftRow, type ListOpts } from "@fullfollow/core";

/** `company_ref` is the company of the recipient (the draft's own, else its person's); the companies module turns it into `company_name` */
const SELECT = `SELECT d.*, p.name AS person_name, COALESCE(d.company_id, p.company_id) AS company_ref, COALESCE(p.name, c.name, d.contact) AS to_name
  FROM drafts d LEFT JOIN people p ON p.id = d.person_id LEFT JOIN companies c ON c.id = d.company_id`;

type Raw = Omit<DraftRow, "company_name"> & { company_ref: number | null };

/** The names of the companies the drafts point at, looked up in one statement through the companies module (null for all without it) */
function withCompanyNames(ctx: Ctx, list: Raw[]): DraftRow[] {
  const names = ctx.mod("companies")?.names(list.flatMap((d) => (d.company_ref ? [d.company_ref] : [])));
  return list.map(({ company_ref, ...d }) => ({ ...d, company_name: (company_ref && names?.get(company_ref)) || null }));
}

/** Filters: status, person_id, company_id, opportunity_id, project_id, company_scope (the company and its people), template_id, followup; q searches the text and the recipient; newest first */
export function draftsList(ctx: Ctx, o: ListOpts): { rows: DraftRow[]; total: number } {
  const f = o.filter ?? {};
  let list = keptRows<Raw>(ctx, `${SELECT} ORDER BY d.id DESC`);
  if (f.status) list = list.filter((d) => d.status === f.status);
  if (f.person_id) list = list.filter((d) => d.person_id === Number(f.person_id));
  if (f.template_id) list = list.filter((d) => d.template_id === Number(f.template_id));
  if (f.company_id) list = list.filter((d) => d.company_id === Number(f.company_id));
  if (f.opportunity_id) list = list.filter((d) => d.opportunity_id === Number(f.opportunity_id));
  if (f.project_id) list = list.filter((d) => d.project_id === Number(f.project_id));
  if (f.company_scope) {
    const ids = new Set(rows<{ id: number }>(ctx, "SELECT id FROM people WHERE company_id = ?", f.company_scope).map((r) => r.id));
    list = list.filter((d) => d.company_id === Number(f.company_scope) || ids.has(d.person_id!));
  }
  if (bool(f.followup)) list = list.filter((d) => d.followup_step);
  list = list.filter((d) => has(o.q, d.body, d.to_name));
  const p = page(list, o.limit, o.offset);
  return { total: p.total, rows: withCompanyNames(ctx, p.rows) };
}

/** One draft in the shape of the list rows */
export function draftGet(ctx: Ctx, id: number): DraftRow | undefined {
  const r = keptRow<Raw>(ctx, `${SELECT} WHERE d.id = ?`, id);
  return r && withCompanyNames(ctx, [r])[0];
}
