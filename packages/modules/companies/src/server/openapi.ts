import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { companyCreate, companyUpdate } from "../service/schemas";

const { crud, defineDocs, directoryFilters, filtered, listOf, object } = docKit;

/** API documentation of the company routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/companies", { noun: "company", filters: directoryFilters, create: companyCreate, update: companyUpdate }),
  "GET /api/companies/overview": {
    summary: "List companies the way the companies screen pages them",
    description: "The list filters plus the screen's own. Each row also carries the people of its tile, its first project and the latest open comment of Claude. "
      + "`counts` holds how many companies are in each segment before the segment filter.",
    query: filtered({
      ...directoryFilters,
      segment: z.enum(["client", "lead", "partner"]).optional().describe("Only the companies of this segment"),
      sort: z.enum(["value", "recent", "name"]).optional().describe("Most valuable first (default), most recently touched first, or by name"),
      ids: z.string().optional().describe("Comma separated company ids"),
    }),
    response: listOf(),
  },
  "GET /api/companies/totals": {
    summary: "Money and decision makers of the whole company book",
    description: "Paid, due and open money with the number of companies each sits in, and the decision makers nobody has touched yet; whatever the filters of the list.",
    response: object,
  },
  "GET /api/companies/:id/card": {
    summary: "Get a company's card",
    description: "One request for the company page: employees, touches (on the company and on its people), opportunities, waiting drafts and comments.",
    response: object,
  },
});
