import { z } from "zod";
import { OWN_PROJECT_STATUSES, SELLABLE, zodKit } from "@fullfollow/core";

const { id, text, optText, patch } = zodKit;

export const ownProjectCreate = z.strictObject({
  name: text,
  description: optText,
  status: z.enum(OWN_PROJECT_STATUSES).default("aktif"),
  sellable: z.enum(SELLABLE).default("belki"),
  sellable_note: optText,
  notes: optText,
  sector_ids: z.array(id).optional(),
});
export const ownProjectUpdate = patch({
  name: text,
  description: optText,
  status: z.enum(OWN_PROJECT_STATUSES),
  sellable: z.enum(SELLABLE),
  sellable_note: optText,
  notes: optText,
  sector_ids: z.array(id),
});
