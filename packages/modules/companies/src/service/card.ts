import { FFError, listThreads, queriesFor, row, type CompanyCard, type Ctx } from "@fullfollow/core";
import { companiesList } from "./list";

/**
 * Firma kartı: çalışanlar, firmaya ve çalışanlarına temaslar, çalışanların fırsatları, bekleyen taslaklar, yorumlar.
 * Çalışanlar people, temaslar network modülünden gelir (yoksa boş).
 * The opportunities come from the pipeline module (empty without it).
 * TODO(modules): drafts through its module once it is one (core query for now)
 */
export function companyCard(ctx: Ctx, id: number): CompanyCard {
  const q = queriesFor(ctx);
  const company = companiesList(ctx, { limit: 100000 }).rows.find((c) => c.id === id);
  if (!company) throw new FFError("not_found", `firma #${id} bulunamadı`);
  const people = ctx.mod("people")?.list({ filter: { company_id: id }, limit: 500 }).rows ?? [];
  const network = ctx.mod("network");
  return {
    row: company,
    people,
    touches: network?.touches.list({ filter: { company_scope: id }, limit: 200 }) ?? { rows: [], total: 0 },
    opportunities: ctx.mod("pipeline")?.opportunities.list({ filter: { company_id: id }, limit: 100000 }).rows ?? [],
    drafts: q.drafts({ filter: { company_scope: id, status: "bekliyor" }, limit: 50 }).rows,
    channels: network?.companyChannels(id) ?? [],
    source: company.source_id ? row(ctx, "SELECT id, name FROM sources WHERE id = ?", company.source_id) ?? null : null,
    threads: listThreads(ctx, { target_type: "company", target_id: id, resolved: "all", messages: true }),
  };
}
