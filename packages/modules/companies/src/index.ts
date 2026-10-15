import { defineModule, row } from "@fullfollow/core";
import { companiesApi } from "./api";
import { entities } from "./entities";
import { m } from "./messages";
import { mcp } from "./mcp";
import { ALL_ROWS } from "./service/constants";
import { companiesList } from "./service/list";

/**
 * Companies: companies, their tags and sectors, contact status and the company card. People, touches and opportunities on the card
 * come from the people, network and pipeline sides.
 * Its tables (companies, company_tags, company_sectors) stay in core's schema; removing this package leaves their rows in place.
 */
export default defineModule({
  key: "companies",
  label: m.label,
  smoke: ["/api/companies"],
  uses: ["people", "network", "pipeline", "projects"],
  api: companiesApi,
  entities,
  contribute: {
    trashTypes: [{ type: "company", label: m.noun }],
    commentTargets: {
      company: {
        table: "companies",
        label: (ctx, id) => row(ctx, "SELECT name FROM companies WHERE id = ?", id)?.name ?? `#${id}`,
      },
    },
    chatCards: {
      company: (ctx, id) => {
        const r = companiesList(ctx, { limit: ALL_ROWS }).rows.find((c) => c.id === id);
        if (!r) throw new Error("company not found");
        return { title: r.name, status: r.contact_status };
      },
    },
  },
  mcp,
});
