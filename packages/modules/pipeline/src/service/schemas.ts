import { z } from "zod";
import { OFFER_ITEMS_MAX, OPP_ROLES, OPP_STAGES, zodKit } from "@fullfollow/core";

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
const offerItem = z.strictObject({ label: text, amount: tl });
const offerDate = date.refine((v) => v !== null, "teklif tarihi gerekli");
export const offerCreate = z.strictObject({
  opportunity_id: id,
  offered_at: offerDate.optional(),
  amount: offerAmount,
  items: z.array(offerItem).max(OFFER_ITEMS_MAX).default([]),
  note: optText,
  file_id: id.nullish(),
});
export const offerUpdate = patch({
  offered_at: offerDate,
  amount: offerAmount,
  items: z.array(offerItem).max(OFFER_ITEMS_MAX),
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
