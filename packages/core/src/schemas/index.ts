import { z } from "zod";
import {
  SOURCE_KINDS,
  LINK_TARGETS, IDEA_STAGES, INTEREST_LEVELS, OWN_PROJECT_STATUSES, SELLABLE, IDEA_PRIORITIES,
  TAG_COLORS, FILE_TARGETS, FILE_NAME_MAX,
} from "../constants";
import * as zodKit from "./kit";

const { id, text, optText, tl, date, dateTime, patch } = zodKit;

export const tagCreate = z.strictObject({ name: text, color: z.enum(TAG_COLORS).optional() });
export const tagUpdate = patch({ name: text, color: z.enum(TAG_COLORS) });

export const sourceCreate = z.strictObject({ name: text, kind: z.enum(SOURCE_KINDS).default("diger"), notes: optText });
export const sourceUpdate = patch({ name: text, kind: z.enum(SOURCE_KINDS), notes: optText });

export const fileCreate = z.strictObject({
  target_type: z.enum(FILE_TARGETS),
  target_id: id,
  name: text.max(FILE_NAME_MAX),
  mime: text,
  size: id,
  stored_name: text,
});

export const sectorCreate = z.strictObject({ name: text, parent_id: id.nullish() });
export const sectorUpdate = patch({ name: text, parent_id: id.nullable() });

export const noteCreate = z.strictObject({ person_id: id, body: text });
export const noteUpdate = patch({ body: text });

const url = z.string().trim().url("geçerli bir link gerekli");
export const linkCreate = z.strictObject({ target_type: z.enum(LINK_TARGETS), target_id: id, label: text, url });
export const linkUpdate = patch({ label: text, url });

// ---- Paket 2: pazarlama ----
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

/** Kişiyi fikre bağla ya da ilgisini güncelle (fikir + kişi başına tek satır) */
export const interestSave = z.strictObject({
  idea_id: id,
  person_id: id,
  interest: z.enum(INTEREST_LEVELS).optional(),
  note: optText.optional(),
  touch_id: id.nullish(),
});
export const interestUpdate = patch({ interest: z.enum(INTEREST_LEVELS), note: optText });

export const commentCreate = z.strictObject({
  /** a record type core or an installed module owns; the comment service checks it against the registry */
  target_type: z.string().trim().min(1).optional(),
  target_id: id.optional(),
  reply_to: id.optional(),
  body: text,
});
export const commentUpdate = patch({ body: text, resolved: z.boolean() });

