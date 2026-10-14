import { z } from "zod";
import { IDEA_PRIORITIES, IDEA_STAGES, INTEREST_LEVELS, zodKit } from "@fullfollow/core";

const { id, text, optText, patch } = zodKit;

export const ideaCreate = z.strictObject({
  title: text,
  problem: optText,
  stage: z.enum(IDEA_STAGES).default("fikir"),
  notes: optText,
  sector_ids: z.array(id).optional(),
  parent_id: id.nullish(),
  own_project_id: id.nullish(),
  priority: z.enum(IDEA_PRIORITIES).optional(),
});
export const ideaUpdate = patch({
  title: text,
  problem: optText,
  stage: z.enum(IDEA_STAGES),
  notes: optText,
  sector_ids: z.array(id),
  parent_id: id.nullable(),
  own_project_id: id.nullable(),
  priority: z.enum(IDEA_PRIORITIES),
  position: z.number().int().min(0),
  done: z.boolean(),
});

/** Kişiyi fikre bağla ya da ilgisini güncelle (fikir + kişi başına tek satır) */
export const interestSave = z.strictObject({
  idea_id: id,
  person_id: id,
  interest: z.enum(INTEREST_LEVELS).optional(),
  note: optText.optional(),
  touch_id: id.nullish(),
});
export const interestUpdate = patch({ interest: z.enum(INTEREST_LEVELS), note: optText });
