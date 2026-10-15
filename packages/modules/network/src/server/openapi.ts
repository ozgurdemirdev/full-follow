import { z } from "zod";
import { CHANNELS, docKit } from "@fullfollow/core";
import { ACTIVITY_PERIODS } from "../service/activity";
import { adoptInput, touchCreate, touchUpdate } from "../service/schemas";

const { crud, defineDocs, flag, limitOf, object, positiveInt, saveResult } = docKit;
const id = positiveInt.optional();

/** API documentation of the network routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/touches", {
    noun: "touch",
    filters: {
      loose: flag("Touches with no person or company, only an address"),
      channel: z.enum(CHANNELS).optional(),
      person_id: id, company_id: id, opportunity_id: id, project_id: id, idea_id: id,
      company_scope: positiveInt.optional().describe("Touches of this company and of its people"),
    },
    create: touchCreate,
    update: touchUpdate,
  }),
  "POST /api/touches/adopt-suggested": {
    summary: "Attach address-only touches to their suggested person or company",
    description: "Send `{ contact }` to limit it to one address.",
    body: adoptInput,
    response: saveResult,
  },
  "GET /api/network": {
    summary: "List who waits for an answer and who went cold",
    query: z.object({ limit: limitOf("Rows per list") }),
    response: object,
  },
  "GET /api/stats/week": { summary: "Get the touch counts of this week and last week", description: "Broken down by channel.", response: object },
  "GET /api/stats/activity": {
    summary: "Get the touch chart numbers",
    description: "Touches per day, week or month, new records and the spread of contact statuses.",
    query: z.object({ period: z.enum(ACTIVITY_PERIODS).optional().describe("Default: week") }),
    response: object,
  },
});
