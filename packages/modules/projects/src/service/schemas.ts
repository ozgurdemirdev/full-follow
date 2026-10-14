import { z } from "zod";
import { MILESTONES, PROJECT_STAGES, zodKit } from "@fullfollow/core";

const { id, text, optText, tl, date, patch } = zodKit;

export const projectCreate = z.strictObject({
  name: text,
  person_id: id,
  opportunity_id: id.nullish(),
  price: tl.default(0),
  started_at: date.optional(),
  maintenance_fee: tl.nullish(),
});
export const projectUpdate = patch({
  name: text,
  price: tl,
  started_at: date,
  delivered_at: date,
  maintenance_fee: tl.nullable(),
});

export const paymentCreate = z.strictObject({
  project_id: id,
  milestone: z.enum(MILESTONES),
  expected_amount: tl,
  due_date: date.optional(),
});
/** paid_amount / paid_at: düzeltme içindir; normal ödeme girişi pay() ile yapılır */
export const paymentUpdate = patch({
  milestone: z.enum(MILESTONES),
  expected_amount: tl,
  due_date: date,
  paid_amount: tl,
  paid_at: date,
});

export const stageMove = z.strictObject({
  stage: z.string(),
  reason: optText,
  position: z.coerce.number().int().min(0).optional(),
});

export const projectStageEnum = z.enum(PROJECT_STAGES);
