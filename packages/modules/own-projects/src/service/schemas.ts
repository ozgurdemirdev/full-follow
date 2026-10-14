import { z } from "zod";
import { OWN_PROJECT_STATUSES, SELLABLE, zodKit } from "@fullfollow/core";
import { OWN_STAGES } from "./constants";

const { id, text, optText, patch } = zodKit;

export const ownProjectCreate = z.strictObject({
  name: text,
  description: optText,
  status: z.enum(OWN_PROJECT_STATUSES).default("aktif"),
  sellable: z.enum(SELLABLE).default("belki"),
  sellable_note: optText,
  notes: optText,
  stage: z.enum(OWN_STAGES).nullish(),
  sector_ids: z.array(id).optional(),
});
export const ownProjectUpdate = patch({
  name: text,
  description: optText,
  status: z.enum(OWN_PROJECT_STATUSES),
  sellable: z.enum(SELLABLE),
  sellable_note: optText,
  notes: optText,
  stage: z.enum(OWN_STAGES).nullable(),
  sector_ids: z.array(id),
});
