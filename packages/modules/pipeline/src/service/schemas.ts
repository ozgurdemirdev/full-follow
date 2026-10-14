import { z } from "zod";
import { MILESTONES, OFFER_ITEMS_MAX, OFFER_PLAN_PARTS_MAX, OFFER_PLAN_TOTAL_PCT, OPP_ROLES, OPP_STAGES, zodKit } from "@fullfollow/core";

const { id, text, optText, tl, date, patch } = zodKit;

export const oppCreate = z.strictObject({
  title: text,
  person_id: id,
  source_id: id,
  stage: z.enum(["bulundu", "temas", "cevap", "gorusme", "teklif"]).default("bulundu"),
  estimated_value: tl.nullish(),
  next_follow_up_at: date.optional(),
  /** ilanın/konunun linki ve tarihi */
  source_url: optText,
  source_date: date.optional(),
});
/** Extra people on an opportunity: a person reference (id or name) with an optional role and note */
const teamMember = z.strictObject({ person: z.union([id, text]), role: z.enum(OPP_ROLES).default("diger"), note: optText });
export const oppUpdate = patch({
  title: text,
  person_id: id,
  source_id: id,
  estimated_value: tl.nullable(),
  next_follow_up_at: date,
  source_url: optText,
  source_date: date,
  /** team changes (MCP): add or change a member by person id or name, remove members */
  add_people: z.array(teamMember),
  remove_people: z.array(z.union([id, text])),
});

export const teamAdd = z.strictObject({ person_id: id, role: z.enum(OPP_ROLES).default("diger"), note: optText });
export const teamUpdate = patch({ role: z.enum(OPP_ROLES), note: optText });

const offerAmount = z.coerce.number().int().positive("teklif tutarı 0'dan büyük olmalı");
/** `amount` is the unit price; the line amount (qty x unit price) is computed on read */
const offerItem = z.strictObject({ label: text, amount: tl, qty: z.coerce.number().int().min(1).default(1) });
/** The payment plan of an offer: milestones, each at most once, whole percents adding up to 100 */
const offerPlan = z.array(z.strictObject({ key: z.enum(MILESTONES), label: text, pct: z.coerce.number().int().min(1).max(OFFER_PLAN_TOTAL_PCT) }))
  .min(1).max(OFFER_PLAN_PARTS_MAX)
  .refine((parts) => new Set(parts.map((p) => p.key)).size === parts.length, "ödeme planında bir aşama bir kez geçer")
  .refine((parts) => parts.reduce((s, p) => s + p.pct, 0) === OFFER_PLAN_TOTAL_PCT, `ödeme planının yüzdeleri ${OFFER_PLAN_TOTAL_PCT} etmeli`);
const offerDate = date.refine((v) => v !== null, "teklif tarihi gerekli");
export const offerCreate = z.strictObject({
  opportunity_id: id,
  offered_at: offerDate.optional(),
  amount: offerAmount,
  items: z.array(offerItem).max(OFFER_ITEMS_MAX).default([]),
  plan: offerPlan.nullish(),
  note: optText,
  file_id: id.nullish(),
});
export const offerUpdate = patch({
  offered_at: offerDate,
  amount: offerAmount,
  items: z.array(offerItem).max(OFFER_ITEMS_MAX),
  plan: offerPlan.nullable(),
  note: optText,
  file_id: id.nullable(),
  /** true accepts this offer (clears the others), false takes the acceptance back */
  accepted: z.boolean(),
});

export const stageMove = z.strictObject({
  stage: z.string(),
  reason: optText,
  position: z.coerce.number().int().min(0).optional(),
});

export const oppStageEnum = z.enum(OPP_STAGES);
