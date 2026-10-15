import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { FEED_KINDS } from "../constants";
import { feedQuery } from "../service/schemas";

const { defineDocs, limitOf, object } = docKit;

/** API documentation of the timeline routes (`GET /api/docs`) */
export const docs = defineDocs({
  "GET /api/timeline": {
    summary: "Get the global activity feed, newest first",
    description: `Page with \`before\` (the previous page's \`next_before\`). \`type\` is a comma separated list of kinds: ${FEED_KINDS.join(", ")}. \`record\` is \`person:12\`.`,
    query: feedQuery,
    response: object,
  },
  "GET /api/timeline/week": {
    summary: "Get the week strip",
    query: z.object({ start: z.string().optional().describe("Any date in the week (default: this week)") }),
    response: object,
  },
  "GET /api/timeline/:type/:id": {
    summary: "Get the timeline of one record, oldest first",
    description: "`type` is person, opportunity or project.",
    query: z.object({ limit: limitOf("Events to return") }),
    params: { type: "person, opportunity or project", id: "Record id" },
    response: object,
  },
});
