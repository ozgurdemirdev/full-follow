import { z } from "zod";
import { CHANNELS, zodKit } from "@fullfollow/core";
import { DRAFT_SUBJECT_MAX, FOLLOWUP_STEP_MAX } from "./constants";

const { id, text, optText, patch, subjectShape, needSubject, subjectMsg } = zodKit;

const subject = z.string().trim().max(DRAFT_SUBJECT_MAX).nullish().transform((v) => v || null);

export const draftCreate = z.strictObject({
  ...subjectShape,
  opportunity_id: id.nullish(),
  project_id: id.nullish(),
  channel: z.enum(CHANNELS),
  subject,
  /** boşsa şablondan doldurulur */
  body: optText,
  reason: optText,
  template_id: id.nullish(),
  followup_step: z.coerce.number().int().min(1).max(FOLLOWUP_STEP_MAX).nullish(),
}).refine(needSubject, subjectMsg);
export const draftUpdate = patch({ channel: z.enum(CHANNELS), subject, body: text, reason: optText, template_id: id.nullable() });
