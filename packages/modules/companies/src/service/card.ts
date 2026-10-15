import { FFError, listThreads, row, type CompanyCard, type Ctx } from "@fullfollow/core";
import { m } from "../messages";
import { ALL_ROWS, CARD_DRAFTS_LIMIT, CARD_PEOPLE_LIMIT, CARD_TOUCHES_LIMIT } from "./constants";
import { companiesList } from "./list";

/**
 * Firma kartı: çalışanlar, firmaya ve çalışanlarına temaslar, çalışanların fırsatları, bekleyen taslaklar, yorumlar.
 * Çalışanlar people, temaslar network modülünden gelir (yoksa boş).
 * The opportunities come from the pipeline module, the waiting drafts from the drafts module (empty without them).
 */
export function companyCard(ctx: Ctx, id: number): CompanyCard {
  const company = companiesList(ctx, { filter: { ids: [id] }, limit: 1 }).rows[0];
  if (!company) throw new FFError("not_found", m.notFound(id));
  const people = ctx.mod("people")?.list({ filter: { company_id: id }, limit: CARD_PEOPLE_LIMIT }).rows ?? [];
  const network = ctx.mod("network");
  return {
    row: company,
    people,
    touches: network?.touches.list({ filter: { company_scope: id }, limit: CARD_TOUCHES_LIMIT }) ?? { rows: [], total: 0 },
    opportunities: ctx.mod("pipeline")?.opportunities.list({ filter: { company_id: id }, limit: ALL_ROWS }).rows ?? [],
    drafts: ctx.mod("drafts")?.list({ filter: { company_scope: id, status: "bekliyor" }, limit: CARD_DRAFTS_LIMIT }).rows ?? [],
    channels: network?.companyChannels(id) ?? [],
    source: company.source_id ? row(ctx, "SELECT id, name FROM sources WHERE id = ?", company.source_id) ?? null : null,
    threads: listThreads(ctx, { target_type: "company", target_id: id, resolved: "all", messages: true }),
  };
}
