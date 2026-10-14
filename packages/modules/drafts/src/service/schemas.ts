import { z } from "zod";
import { CHANNELS, zodKit } from "@fullfollow/core";

const { id, text, optText, patch, subjectShape, needSubject, subjectMsg } = zodKit;

export const draftCreate = z.strictObject({
  ...subjectShape,
  opportunity_id: id.nullish(),
  project_id: id.nullish(),
  channel: z.enum(CHANNELS),
  /** boşsa şablondan doldurulur */
  body: optText,
  reason: optText,
  template_id: id.nullish(),
  followup_step: z.coerce.number().int().min(1).max(10).nullish(),
}).refine(needSubject, subjectMsg);
export const draftUpdate = patch({ channel: z.enum(CHANNELS), body: text, reason: optText, template_id: id.nullable() });
