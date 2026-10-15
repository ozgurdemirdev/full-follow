import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { personCreate, personUpdate } from "../service/schemas";

const { crud, defineDocs, directoryFilters, filtered, flag, listOf, object, positiveInt } = docKit;

const listFilters = {
  ...directoryFilters,
  awaiting: flag("People whose last touch is ours and still unanswered, longest wait first"),
  cooling: flag("People gone cold, longest silence first"),
  channel: z.string().optional().describe("People with a touch on this channel"),
  company_id: positiveInt.optional(),
  referred_by_id: positiveInt.optional().describe("People introduced by this person"),
  post_id: positiveInt.optional().describe("People who came from this post"),
  follow_up_due: flag("People whose next follow-up date has come"),
};

/** API documentation of the people routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/people", { noun: "person", filters: listFilters, create: personCreate, update: personUpdate }),
  "GET /api/people/overview": {
    summary: "List people the way the people screen pages them",
    description: "The list filters plus the screen's own, sorted by state (due, wait, cold, fresh, the rest) and then as the list is. "
      + "`counts` holds how many people are in each state before the state filter.",
    query: filtered({
      ...listFilters,
      state: z.enum(["due", "wait", "cold", "fresh"]).optional().describe("Only the people in this state"),
      has_channel: z.enum(["linkedin", "email", "telefon", "instagram"]).optional().describe("People with an account on this channel"),
      ids: z.string().optional().describe("Comma separated person ids"),
      company_ids: z.string().optional().describe("Comma separated company ids"),
      post_ids: z.string().optional().describe("Comma separated post ids"),
    }),
    response: listOf(),
  },
  "GET /api/people/summary": {
    summary: "What the whole people book holds",
    description: "The number of people and how many of them are cooling, whatever the filters of the list.",
    response: object,
  },
  "GET /api/people/touch-queue": {
    summary: "The people to reach out to first",
    description: "By state (due follow-up, awaited reply, cooling), then the most overdue first. `all` includes everyone; `exclude` leaves ids out.",
    query: z.object({
      limit: positiveInt.optional(),
      exclude: z.string().optional().describe("Comma separated person ids to leave out"),
      all: flag("Take people in every state, not only the due, awaiting and cooling ones"),
    }),
    response: object,
  },
  "GET /api/people/:id/card": {
    summary: "Get a person's card",
    description: "One request for the person page: touches, notes, comments with their messages, the referral network and its value, opportunities, projects and waiting drafts.",
    response: object,
  },
});
