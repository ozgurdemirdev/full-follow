import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { personCreate, personUpdate } from "../service/schemas";

const { crud, defineDocs, directoryFilters, flag, object, positiveInt } = docKit;

/** API documentation of the people routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/people", {
    noun: "person",
    filters: {
      ...directoryFilters,
      awaiting: flag("People whose last touch is ours and still unanswered, longest wait first"),
      cooling: flag("People gone cold, longest silence first"),
      channel: z.string().optional().describe("People with a touch on this channel"),
      company_id: positiveInt.optional(),
      referred_by_id: positiveInt.optional().describe("People introduced by this person"),
      post_id: positiveInt.optional().describe("People who came from this post"),
      follow_up_due: flag("People whose next follow-up date has come"),
    },
    create: personCreate,
    update: personUpdate,
  }),
  "GET /api/people/:id/card": {
    summary: "Get a person's card",
    description: "One request for the person page: touches, notes, comments with their messages, the referral network and its value, opportunities, projects and waiting drafts.",
    response: object,
  },
});
