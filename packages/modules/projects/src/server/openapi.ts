import { z } from "zod";
import { docKit, PROJECT_STAGES } from "@fullfollow/core";
import { paymentCreate, paymentUpdate, projectCreate, projectStageEnum, projectUpdate, stageMove } from "../service/schemas";

const { crud, defineDocs, flag, positiveInt, saveResult } = docKit;

/** API documentation of the projects routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/projects", {
    noun: "project",
    filters: {
      stage: z.enum(PROJECT_STAGES).optional(),
      person_id: positiveInt.optional(),
      active: flag("Not cancelled, in maintenance or delivered"),
    },
    create: projectCreate,
    update: projectUpdate,
  }),
  "POST /api/projects/:id/move": {
    summary: "Move a project to a stage",
    description: "A project cannot leave the deposit stage until the deposit is fully paid; going back and cancelling are free. `PATCH` refuses a `stage` field.",
    body: stageMove.extend({ stage: projectStageEnum }),
    response: saveResult,
  },

  ...crud("/api/payments", {
    noun: "payment",
    filters: {
      project_id: positiveInt.optional(),
      status: z.enum(["odendi", "kismi", "gecikmis", "bekliyor"]).optional().describe("Computed from the amounts and the due date"),
      overdue: flag("Only late payments"),
      unpaid: flag("Everything not fully paid"),
      due_within_days: z.number().int().min(0).optional().describe("Unpaid payments due within this many days"),
    },
    create: paymentCreate,
    update: paymentUpdate,
  }),
  "POST /api/payments/:id/pay": {
    summary: "Record money received on a payment",
    description: "The amount (whole TL) is added to what was paid; the date defaults to today.",
    body: z.object({ amount: positiveInt, date: z.string().optional().describe("YYYY-MM-DD") }),
    response: saveResult,
  },
});
