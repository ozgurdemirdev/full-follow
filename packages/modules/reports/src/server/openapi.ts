import { z } from "zod";
import { docKit } from "@fullfollow/core";

const { defineDocs, object } = docKit;

/** API documentation of the reports routes (`GET /api/docs`) */
export const docs = defineDocs({
  "GET /api/report": {
    summary: "Get the report",
    description: "Source conversion plus the month's collection against the price floor.",
    query: z.object({ month: z.string().optional().describe("YYYY-MM (default: this month)") }),
    response: object,
  },
  "GET /api/report/months": {
    summary: "Get the collection against the floor for the last months",
    description: "The series behind the chart.",
    query: z.object({ count: z.number().int().min(1).max(60).optional().describe("Number of months, 1 to 60 (default 6)") }),
    response: z.array(object),
  },
  "GET /api/report/marketing": { summary: "Get the marketing summary", description: "Posts, ideas, templates and channel performance.", response: object },
  "GET /api/review": {
    summary: "Get the weekly review",
    description: "The Friday summary of a week: what was done against the target and what to do next.",
    query: z.object({ week: z.string().optional().describe("ISO week (2026-W41) or any date in it; default: this week") }),
    response: object,
  },
});
