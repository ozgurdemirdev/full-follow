import { z } from "zod";
import { CHANNELS, docKit, TEMPLATE_KINDS } from "@fullfollow/core";
import { templateCreate, templateUpdate } from "../service/schemas";

const { crud, defineDocs, object, positiveInt } = docKit;

/** The recipient of a suggestion or a preview: a person, a company or an address */
const subject = {
  person_id: positiveInt.optional(),
  company_id: positiveInt.optional(),
  contact: z.string().optional().describe("An address or account, when there is no person or company"),
};

/** API documentation of the templates routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/templates", {
    noun: "template",
    filters: {
      kind: z.enum(TEMPLATE_KINDS).optional(),
      channel: z.enum(CHANNELS).optional().describe("A template for all channels fits any"),
      sector: z.string().optional().describe("Sector id, name or path; a main sector includes its sub sectors"),
    },
    create: templateCreate,
    update: templateUpdate,
    list: { description: "`q` searches name, text and sector." },
  }),
  "GET /api/templates/suggest": {
    summary: "Suggest templates for a recipient",
    description: "The templates that fit the person or company and the channel, best first.",
    query: z.object({ ...subject, channel: z.enum(CHANNELS).optional(), kind: z.enum(TEMPLATE_KINDS).optional() }),
    response: z.array(object),
  },
  "GET /api/templates/:id/render": {
    summary: "Preview a template applied to a recipient",
    query: z.object(subject),
    response: object,
  },
});
