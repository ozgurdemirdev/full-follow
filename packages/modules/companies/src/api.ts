import type { CompaniesApi, Ctx } from "@fullfollow/core";
import { companiesServices } from "./service";
import { companyCard } from "./service/card";
import { companiesList } from "./service/list";
import { bumpCompanyStatus } from "./service/status";

/** The companies module's implementation of its contract (`CompaniesApi` in core's contracts) */
export function companiesApi(ctx: Ctx): CompaniesApi {
  const { companies } = companiesServices(ctx);
  return {
    // company rows come from text columns (the schema stays free of module enums); the contract narrows the contact status
    create: companies.create as CompaniesApi["create"],
    update: companies.update as CompaniesApi["update"],
    remove: companies.remove,
    list: (opts) => companiesList(ctx, opts),
    get: (id) => companiesList(ctx, { limit: 100000 }).rows.find((c) => c.id === id),
    card: (id) => companyCard(ctx, id),
    bumpStatus: (id, next) => bumpCompanyStatus(ctx, id, next),
  };
}
