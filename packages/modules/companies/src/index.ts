import { defineModule, row } from "@fullfollow/core";
import { companiesApi } from "./api";
import { entities } from "./entities";
import { mcp } from "./mcp";
import { companiesList } from "./service/list";

/**
 * Companies: companies, their tags and sectors, contact status and the company card. People, touches and opportunities on the card
 * come from the people, network and pipeline sides.
 * Its tables (companies, company_tags, company_sectors) stay in core's schema; removing this package leaves their rows in place.
 */
export default defineModule({
  key: "companies",
  label: "Firmalar",
  uses: ["people", "network"],
  api: companiesApi,
  entities,
  contribute: {
    trashTypes: [{ type: "company", label: "firma" }],
    commentTargets: {
      company: {
        table: "companies",
        label: (ctx, id) => row(ctx, "SELECT name FROM companies WHERE id = ?", id)?.name ?? `#${id}`,
      },
    },
    chatCards: {
      company: (ctx, id) => {
        const r = companiesList(ctx, { limit: 100000 }).rows.find((c) => c.id === id);
        if (!r) throw new Error("company not found");
        return { title: r.name, status: r.contact_status };
      },
    },
  },
  mcp,
});
