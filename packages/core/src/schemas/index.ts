import { z } from "zod";
import {
  TAGS, SOURCE_KINDS, OPP_STAGES, CHANNELS, DIRECTIONS, TOUCH_KINDS, PROJECT_STAGES, MILESTONES,
  ASSIGNEES, COMMENT_TARGETS,
} from "../constants";
import { isIsoDate, isIsoDateTime, resolveRelativeDate } from "../dates";

const id = z.coerce.number().int().positive();
const text = z.string().trim().min(1);
const optText = z.string().trim().nullish().transform((v) => (v ? v : null));
const tl = z.coerce.number().int().min(0);

/** YYYY-MM-DD; "bugün", "yarın", "+3g" gibi kısa biçimler de kabul edilir. Boş değer = temizle. */
const date = z.preprocess(
  (v) => (v === "" ? null : resolveRelativeDate(v)),
  z.string().refine(isIsoDate, "tarih YYYY-MM-DD olmalı").nullable(),
);
const dateTime = z.preprocess(
  (v) => resolveRelativeDate(v),
  z.string().refine(isIsoDateTime, "tarih ISO olmalı"),
);

/** create şemasını güncellemeye çevirir: alanlar opsiyonel */
const patch = <T extends z.ZodRawShape>(shape: T) => z.object(shape).partial();

export const companyCreate = z.object({ name: text, website: optText, notes: optText });
export const companyUpdate = patch({ name: text, website: optText, notes: optText });

const personShape = {
  name: text,
  company_id: id.nullable(),
  email: optText,
  phone: optText,
  handle: optText,
  referred_by_id: id.nullable(),
  next_follow_up_at: date,
  notes: optText,
};
export const personCreate = z.object({
  ...personShape,
  company_id: personShape.company_id.optional(),
  referred_by_id: personShape.referred_by_id.optional(),
  next_follow_up_at: personShape.next_follow_up_at.optional(),
  tags: z.array(z.enum(TAGS)).optional(),
});
export const personUpdate = patch(personShape).extend({
  tags: z.array(z.enum(TAGS)).optional(),
  add_tags: z.array(z.enum(TAGS)).optional(),
  remove_tags: z.array(z.enum(TAGS)).optional(),
});

export const sourceCreate = z.object({ name: text, kind: z.enum(SOURCE_KINDS).default("diger"), notes: optText });
export const sourceUpdate = patch({ name: text, kind: z.enum(SOURCE_KINDS), notes: optText });

export const oppCreate = z.object({
  title: text,
  person_id: id,
  source_id: id,
  stage: z.enum(["bulundu", "temas", "cevap", "gorusme", "teklif"]).default("bulundu"),
  estimated_value: tl.nullish(),
  next_follow_up_at: date.optional(),
});
export const oppUpdate = patch({
  title: text,
  person_id: id,
  source_id: id,
  estimated_value: tl.nullable(),
  next_follow_up_at: date,
});

export const projectCreate = z.object({
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

export const touchCreate = z.object({
  person_id: id,
  opportunity_id: id.nullish(),
  project_id: id.nullish(),
  channel: z.enum(CHANNELS),
  direction: z.enum(DIRECTIONS),
  kind: z.enum(TOUCH_KINDS).default("mesaj"),
  summary: text,
  outcome: optText,
  happened_at: dateTime.optional(),
});

export const draftCreate = z.object({
  person_id: id,
  opportunity_id: id.nullish(),
  project_id: id.nullish(),
  channel: z.enum(CHANNELS),
  body: text,
});
export const draftUpdate = patch({ channel: z.enum(CHANNELS), body: text });

export const paymentCreate = z.object({
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

export const taskCreate = z.object({
  title: text,
  assignee: z.enum(ASSIGNEES).default("ozgur"),
  due_date: date.optional(),
  person_id: id.nullish(),
  opportunity_id: id.nullish(),
  project_id: id.nullish(),
});
export const taskUpdate = patch({
  title: text,
  assignee: z.enum(ASSIGNEES),
  due_date: date,
  person_id: id.nullable(),
  opportunity_id: id.nullable(),
  project_id: id.nullable(),
  done: z.boolean(),
});

export const commentCreate = z.object({
  target_type: z.enum(COMMENT_TARGETS).optional(),
  target_id: id.optional(),
  reply_to: id.optional(),
  body: text,
});
export const commentUpdate = patch({ body: text, resolved: z.boolean() });

export const stageMove = z.object({
  stage: z.string(),
  reason: optText,
  position: z.coerce.number().int().min(0).optional(),
});

export const oppStageEnum = z.enum(OPP_STAGES);
export const projectStageEnum = z.enum(PROJECT_STAGES);
