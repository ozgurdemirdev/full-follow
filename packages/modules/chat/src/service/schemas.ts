import { z } from "zod";
import { CHAT_INPUT_MODES } from "@fullfollow/core";
import { CHAT_EFFORT_IDS, CHAT_FIELD_MAX, CHAT_LIMITS, CHAT_MODEL_IDS } from "../constants";
import { m } from "../messages";

const model = z.enum(CHAT_MODEL_IDS);
const effort = z.enum(CHAT_EFFORT_IDS);

export const chatSessionCreate = z.strictObject({ model: model.optional(), effort: effort.optional() });
export const chatSessionUpdate = z.strictObject({ title: z.string().trim().min(1).max(CHAT_FIELD_MAX.title).optional(), model: model.optional(), effort: effort.optional() });
export const chatMessageCreate = z.strictObject({
  body: z.string().trim().max(CHAT_LIMITS.maxBodyChars).default(""),
  client_id: z.string().trim().min(1).max(CHAT_FIELD_MAX.clientId),
  input_mode: z.enum(CHAT_INPUT_MODES).default("text"),
  attachment_ids: z.array(z.coerce.number().int().positive()).max(CHAT_LIMITS.maxAttachments).default([]),
}).refine((d) => d.body.length > 0 || d.attachment_ids.length > 0, { message: m.errors.messageOrFile });
export const chatAttachmentCreate = z.strictObject({
  name: z.string().trim().min(1).max(CHAT_FIELD_MAX.attachmentName),
  mime: z.string().min(1),
  size: z.number().int().min(0),
  path: z.string().min(1),
});
export const chatSessionsQuery = z.strictObject({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(CHAT_LIMITS.sessionsPageSize).default(CHAT_LIMITS.sessionsPageSize),
});
export const chatMessagesQuery = z.strictObject({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(CHAT_LIMITS.messagesPageSize).default(CHAT_LIMITS.messagesPageSize),
});
export const chatFinish = z.strictObject({
  state: z.enum(["done", "error", "stopped"]),
  error: z.string().nullish(),
  usage: z.strictObject({ input_tokens: z.number().int().min(0), output_tokens: z.number().int().min(0) }).optional(),
  cost_usd: z.number().min(0).optional(),
  context_tokens: z.number().int().min(0).optional(),
  ack: z.boolean().optional(),
});
