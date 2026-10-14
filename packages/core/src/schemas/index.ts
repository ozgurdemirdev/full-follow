import { z } from "zod";
import {
  SOURCE_KINDS, OPP_STAGES, CHANNELS, PROJECT_STAGES, MILESTONES,
  LINK_TARGETS, TEMPLATE_KINDS, IDEA_STAGES, INTEREST_LEVELS, OWN_PROJECT_STATUSES, SELLABLE, IDEA_PRIORITIES,
  TAG_COLORS, OPP_ROLES, FILE_TARGETS, FILE_NAME_MAX, OFFER_ITEMS_MAX,
} from "../constants";
import * as zodKit from "./kit";

const { id, text, optText, tl, date, dateTime, patch } = zodKit;

export const tagCreate = z.strictObject({ name: text, color: z.enum(TAG_COLORS).optional() });
export const tagUpdate = patch({ name: text, color: z.enum(TAG_COLORS) });

export const sourceCreate = z.strictObject({ name: text, kind: z.enum(SOURCE_KINDS).default("diger"), notes: optText });
export const sourceUpdate = patch({ name: text, kind: z.enum(SOURCE_KINDS), notes: optText });

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

export const fileCreate = z.strictObject({
  target_type: z.enum(FILE_TARGETS),
  target_id: id,
  name: text.max(FILE_NAME_MAX),
  mime: text,
  size: id,
  stored_name: text,
});

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

const { subjectShape: subject, needSubject, subjectMsg } = zodKit;

export const sectorCreate = z.strictObject({ name: text, parent_id: id.nullish() });
export const sectorUpdate = patch({ name: text, parent_id: id.nullable() });

export const noteCreate = z.strictObject({ person_id: id, body: text });
export const noteUpdate = patch({ body: text });

const url = z.string().trim().url("geçerli bir link gerekli");
export const linkCreate = z.strictObject({ target_type: z.enum(LINK_TARGETS), target_id: id, label: text, url });
export const linkUpdate = patch({ label: text, url });

export const draftCreate = z.strictObject({
  ...subject,
  opportunity_id: id.nullish(),
  project_id: id.nullish(),
  channel: z.enum(CHANNELS),
  /** boşsa şablondan doldurulur */
  body: optText,
  reason: optText,
  template_id: id.nullish(),
  followup_step: z.coerce.number().int().min(1).max(10).nullish(),
}).refine(needSubject, subjectMsg);
export const draftUpdate = patch({ channel: z.enum(CHANNELS), body: text, reason: optText, template_id: id.nullable() });

// ---- Paket 2: pazarlama ----
export const templateCreate = z.strictObject({
  name: text,
  kind: z.enum(TEMPLATE_KINDS).default("ilk"),
  channel: z.enum(CHANNELS).nullish(),
  sector_id: id.nullish(),
  body: text,
});
export const templateUpdate = patch({
  name: text,
  kind: z.enum(TEMPLATE_KINDS),
  channel: z.enum(CHANNELS).nullable(),
  sector_id: id.nullable(),
  body: text,
});

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

export const commentCreate = z.strictObject({
  /** a record type core or an installed module owns; the comment service checks it against the registry */
  target_type: z.string().trim().min(1).optional(),
  target_id: id.optional(),
  reply_to: id.optional(),
  body: text,
});
export const commentUpdate = patch({ body: text, resolved: z.boolean() });

export const stageMove = z.strictObject({
  stage: z.string(),
  reason: optText,
  position: z.coerce.number().int().min(0).optional(),
});

export const oppStageEnum = z.enum(OPP_STAGES);
export const projectStageEnum = z.enum(PROJECT_STAGES);
