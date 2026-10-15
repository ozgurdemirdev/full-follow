import { docKit } from "@fullfollow/core";
import { companyCreate, companyUpdate } from "../service/schemas";

const { crud, defineDocs, directoryFilters, object } = docKit;

/** API documentation of the company routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/companies", { noun: "company", filters: directoryFilters, create: companyCreate, update: companyUpdate }),
  "GET /api/companies/:id/card": {
    summary: "Get a company's card",
    description: "One request for the company page: employees, touches (on the company and on its people), opportunities, waiting drafts and comments.",
    response: object,
  },
});
