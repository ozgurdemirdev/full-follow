import { z } from "zod";
import { CHANNELS, zodKit } from "@fullfollow/core";
import { m } from "../messages";
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

/**
 * Rejecting: a note (the reason Claude learns from) or an explicit `no_reason` when the owner gave none; a bare text is a note.
 * Asking for no reason is a flag of its own, so no note text has to be matched later to tell the two apart.
 */
export const draftReject = z.preprocess(
  (v) => (typeof v === "string" ? { note: v } : v),
  z.strictObject({ note: z.string().trim().optional(), no_reason: z.boolean().optional() })
    .refine((i) => !!i.note || i.no_reason === true, m.error.rejectNote),
);
