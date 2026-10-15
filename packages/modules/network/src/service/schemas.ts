import { z } from "zod";
import { CHANNELS, DIRECTIONS, TOUCH_KINDS, zodKit } from "@fullfollow/core";
import { m } from "../messages";

const { id, text, optText, dateTime, patch, subjectShape, needSubject, subjectMsg } = zodKit;

export const touchCreate = z.strictObject({
  ...subjectShape,
  opportunity_id: id.nullish(),
  project_id: id.nullish(),
  channel: z.enum(CHANNELS),
  direction: z.enum(DIRECTIONS),
  kind: z.enum(TOUCH_KINDS).default("mesaj"),
  summary: text,
  outcome: optText,
  happened_at: dateTime.optional(),
  /** verilmezse: giden mesaj → evet, diğerleri → hayır */
  expects_reply: z.boolean().optional(),
  /** Paket 2: temas bir fikir hakkındaysa kişi fikre "anlatıldı" olarak bağlanır */
  idea_id: id.nullish(),
}).refine(needSubject, subjectMsg);

export const touchUpdate = patch({
  channel: z.enum(CHANNELS),
  kind: z.enum(TOUCH_KINDS),
  summary: text,
  outcome: optText,
  happened_at: dateTime,
  expects_reply: z.boolean(),
  idea_id: id.nullable(),
  /** a loose touch (only an address) moves to this person or company; one of the two */
  person_id: id,
  company_id: id,
}).refine((d) => !(d.person_id && d.company_id), { message: m.error.onePlace, path: ["person_id"] });

/** Which loose touches `adoptSuggested` moves: those written with this address as it stands on the touch (all with a suggestion when empty) */
export const adoptInput = z.strictObject({ contact: optText });
