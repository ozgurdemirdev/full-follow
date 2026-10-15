import { z } from "zod";
import { docKit, IDEA_STAGES, INTEREST_LEVELS } from "@fullfollow/core";
import { ideaCreate, ideaUpdate, interestSave, interestUpdate } from "../service/schemas";

const { crud, defineDocs, filtered, flag, listOf, positiveInt, saveResult } = docKit;

/** API documentation of the ideas routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/ideas", {
    noun: "idea",
    filters: {
      stage: z.enum(IDEA_STAGES).optional(),
      sector: z.string().optional().describe("Sector id, name or path; a main sector includes its sub sectors"),
      own_project: z.string().optional().describe("Own project name or id"),
      general: flag("Only ideas that belong to no own project"),
    },
    create: ideaCreate,
    update: ideaUpdate,
    list: { description: "`q` searches title, problem and notes." },
  }),
  "GET /api/ideas/people": {
    summary: "List people linked to ideas, with their interest",
    query: filtered({ idea_id: positiveInt.optional(), person_id: positiveInt.optional(), interest: z.enum(INTEREST_LEVELS).optional() }),
    response: listOf(),
  },
  "POST /api/ideas/:id/people": {
    summary: "Link a person to an idea or update their interest",
    description: "The idea id comes from the path.",
    body: interestSave.omit({ idea_id: true }),
    response: saveResult,
  },
  "PATCH /api/ideas/people/:linkId": { summary: "Update a person's interest in an idea", body: interestUpdate, response: saveResult, params: { linkId: "Id of the person to idea link" } },
  "DELETE /api/ideas/people/:linkId": { summary: "Unlink a person from an idea", response: saveResult, params: { linkId: "Id of the person to idea link" } },
});
