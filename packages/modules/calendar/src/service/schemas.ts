import { z } from "zod";
import { ASSIGNEES, CHANNELS, zodKit } from "@fullfollow/core";
import { DEFAULT_TASK_KIND, GOAL_DAY_PRESETS, GOAL_METRICS, TASK_KINDS, TIME_RE } from "./constants";

const { id, text, optText, date, patch } = zodKit;

/** HH:MM, 00:00 to 23:59. Empty value = clear. */
const time = z.preprocess((v) => (v === "" ? null : v), z.string().regex(TIME_RE, "saat HH:MM olmalı (00:00 ile 23:59 arası)").nullable());

export const taskCreate = z.strictObject({
  title: text,
  assignee: z.enum(ASSIGNEES).default("ozgur"),
  due_date: date.optional(),
  due_time: time.optional(),
  kind: z.enum(TASK_KINDS).default(DEFAULT_TASK_KIND),
  person_id: id.nullish(),
  company_id: id.nullish(),
  opportunity_id: id.nullish(),
  project_id: id.nullish(),
});
/** Calendar quick add: one line of text, the time and kind are read from it */
export const taskQuick = z.strictObject({ text, due_date: date.optional(), assignee: z.enum(ASSIGNEES).default("ozgur") });
export const taskUpdate = patch({
  title: text,
  assignee: z.enum(ASSIGNEES),
  due_date: date,
  due_time: time,
  kind: z.enum(TASK_KINDS),
  person_id: id.nullable(),
  company_id: id.nullable(),
  opportunity_id: id.nullable(),
  project_id: id.nullable(),
  done: z.boolean(),
});

// ---- Günlük iş planı ----
/** Tekrar günleri: ISO numaraları dizisi (1 = pazartesi) ya da "her_gun" | "hafta_ici" | "hafta_sonu"; veritabanında virgüllü metin */
const goalDays = z.union([z.enum(Object.keys(GOAL_DAY_PRESETS) as [keyof typeof GOAL_DAY_PRESETS, ...(keyof typeof GOAL_DAY_PRESETS)[]]), z.array(z.coerce.number().int().min(1).max(7)).min(1)])
  .transform((v) => [...new Set(typeof v === "string" ? GOAL_DAY_PRESETS[v] : v)].sort().join(","));

export const goalCreate = z.strictObject({
  title: text,
  target: z.coerce.number().int().positive(),
  days: goalDays.default("1,2,3,4,5,6,7"),
  channel: z.enum(CHANNELS).nullish(),
  metric: z.enum(GOAL_METRICS).nullish(),
  note: optText,
});
export const goalUpdate = patch({
  title: text,
  target: z.coerce.number().int().positive(),
  days: goalDays,
  channel: z.enum(CHANNELS).nullable(),
  metric: z.enum(GOAL_METRICS).nullable(),
  note: optText,
});

/** Bir günün elle girilen sayısı: add = üstüne ekle, count = o günün sayısını belirle; note = o güne not */
export const goalLogInput = z.strictObject({
  goal_id: id,
  date: date.optional(),
  add: z.coerce.number().int().optional(),
  count: z.coerce.number().int().min(0).optional(),
  note: z.string().trim().nullish(),
});
