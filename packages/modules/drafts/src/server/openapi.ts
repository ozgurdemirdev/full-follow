import { z } from "zod";
import { DRAFT_STATUSES, docKit } from "@fullfollow/core";
import { draftCreate, draftReject, draftUpdate } from "../service/schemas";

const { crud, defineDocs, flag, object, positiveInt, saveResult } = docKit;
const id = positiveInt.optional();

/** API documentation of the drafts routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/drafts", {
    noun: "draft",
    filters: {
      status: z.enum(DRAFT_STATUSES).optional(),
      person_id: id, company_id: id, opportunity_id: id, project_id: id, template_id: id,
      company_scope: positiveInt.optional().describe("Drafts to this company and to its people"),
      followup: flag("Only follow-up sequence drafts"),
    },
    create: draftCreate,
    update: draftUpdate,
    list: { description: "Newest first; `q` searches the text and the recipient." },
  }),
  "POST /api/drafts/:id/approve": { summary: "Approve a draft", description: "Only the owner approves; the MCP host has no such tool.", response: saveResult },
  "POST /api/drafts/:id/reject": {
    summary: "Reject a draft with a note",
    description: "Send the reason as `note` (it also joins the learned rules Claude reads before the next draft) or `no_reason: true` when the owner gave none.",
    body: draftReject,
    response: saveResult,
  },
  "POST /api/drafts/:id/send": { summary: "Mark a draft as sent", description: "The owner sent it: records an outgoing touch and applies the opportunity stage rule (when the network module is installed).", response: saveResult },

  "GET /api/followups": { summary: "List follow-ups that are due", description: "People whose follow-up step has come and who have no waiting draft yet.", response: object },
  "POST /api/followups/run": { summary: "Prepare the follow-up drafts now", description: "Does at once what the scheduler does each day; the drafts are written as Claude.", response: object },
});
