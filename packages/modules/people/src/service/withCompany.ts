import { FFError, resolveRef, type Ctx } from "@fullfollow/core";

/**
 * Kişinin firması adla verilip (`company: "ABC Ltd"`) bulunamazsa firma açılır: toplu listede firmalar ayrıca eklenmesin.
 * Firma çöp kutusundaysa mükerrer hatası döner. Firma adı ancak companies modülü kuruluysa kabul edilir.
 */
export function withCompany(ctx: Ctx, data: Record<string, any>): Record<string, any> {
  if (typeof data.company !== "string" || !data.company.trim() || data.company_id !== undefined) return data;
  const companies = ctx.mod("companies");
  if (!companies) throw new FFError("validation", `firma adı verildi ("${data.company}") ama "companies" modülü kurulu değil; firma adı yerine company_id ver`);
  const { company, ...rest } = data;
  try {
    return { ...rest, company_id: resolveRef(ctx, "company", company) };
  } catch (e) {
    if (!(e instanceof FFError) || e.code !== "not_found") throw e;
    return { ...rest, company_id: companies.create({ name: company }).row.id };
  }
}
