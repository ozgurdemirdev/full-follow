import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { offerCreate, offerUpdate, oppCreate, oppStageEnum, oppUpdate, stageMove, teamAdd, teamUpdate } from "../service/schemas";

const { crud, defineDocs, flag, listOf, object, positiveInt, saveResult } = docKit;

/** API documentation of the pipeline routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/opportunities", {
    noun: "opportunity",
    filters: {
      stage: oppStageEnum.optional(),
      person_id: positiveInt.optional(),
      source_id: positiveInt.optional(),
      company_id: positiveInt.optional(),
      open: flag("Only open opportunities"),
      due: flag("Opportunities whose follow-up date has come"),
      board: flag("Open opportunities and those closed in the last 30 days (the kanban)"),
    },
    create: oppCreate,
    update: oppUpdate,
    list: {
      description: "The list plus `meta`: the stage rules (stale days) and the stage to stage rates of the last 90 days.",
      response: listOf().extend({ meta: object }),
    },
  }),
  "POST /api/opportunities/:id/move": {
    summary: "Move an opportunity to a stage",
    description: "The kanban move. Winning opens the project from the accepted offer (an event the projects module hooks); losing asks for a reason. The effects say what happened.",
    body: stageMove.extend({ stage: oppStageEnum }),
    response: saveResult,
  },

  "POST /api/offers": { summary: "Create an offer version for an opportunity", body: offerCreate, response: saveResult },
  "PATCH /api/offers/:id": { summary: "Update an offer", description: "`{ accepted: true }` accepts it, `false` un-accepts it.", body: offerUpdate, response: saveResult },
  "DELETE /api/offers/:id": { summary: "Delete an offer", response: saveResult },

  "POST /api/opportunity-people": {
    summary: "Add a person to an opportunity's team",
    description: "Changes the role when the person is already on the team. Listed through `GET /api/opportunities/:id?with=people`.",
    body: teamAdd.extend({ opportunity_id: positiveInt }),
    response: saveResult,
  },
  "PATCH /api/opportunity-people/:id": { summary: "Update a team member's role or note", body: teamUpdate, response: saveResult },
  "DELETE /api/opportunity-people/:id": { summary: "Remove a person from an opportunity's team", response: saveResult },

  "GET /api/report/sources": {
    summary: "Get the source funnel",
    description: "Per source: found, written, answered, met, offered, won.",
    query: z.object({ period: z.enum(["30", "90", "all"]).optional().describe("Days back by creation date, or all (default: 90)") }),
    response: object,
  },
});
