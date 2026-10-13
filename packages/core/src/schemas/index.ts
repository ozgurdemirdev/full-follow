import { z } from "zod";
import {
  SOURCE_KINDS, OPP_STAGES, CHANNELS, DIRECTIONS, TOUCH_KINDS, PROJECT_STAGES, MILESTONES,
  ASSIGNEES, COMMENT_TARGETS, LINK_TARGETS, POST_PLATFORMS, TEMPLATE_KINDS, IDEA_STAGES, INTEREST_LEVELS, OWN_PROJECT_STATUSES, SELLABLE, IDEA_PRIORITIES,
  CONTACT_STATUSES, TAG_COLORS, GOAL_DAY_PRESETS, OPP_ROLES, FILE_TARGETS, FILE_NAME_MAX, OFFER_ITEMS_MAX,
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
const patch = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape).partial();

/** Etiket ya da sektör: id, ad ("Sıcak") ya da sektör yolu ("Sağlık > Diş hekimi") */
const refList = z.array(z.union([z.number().int().positive(), z.string().trim().min(1)]));
/** Kişi ve firmada ortak: etiketler (tags tümünü değiştirir, add_tags/remove_tags ekler/çıkarır) ve sektörler */
const labels = {
  tags: refList.optional(),
  add_tags: refList.optional(),
  remove_tags: refList.optional(),
  sectors: refList.optional(),
};

const companyShape = {
  name: text,
  website: optText,
  email: optText,
  phone: optText,
  instagram: optText,
  linkedin: optText,
  source_id: id.nullable(),
  contact_status: z.enum(CONTACT_STATUSES),
  notes: optText,
};
export const companyCreate = z.strictObject({
  ...companyShape,
  source_id: companyShape.source_id.optional(),
  contact_status: companyShape.contact_status.optional(),
  ...labels,
});
export const companyUpdate = patch(companyShape).extend(labels);

const personShape = {
  name: text,
  company_id: id.nullable(),
  role: optText,
  email: optText,
  phone: optText,
  instagram: optText,
  linkedin: optText,
  handle: optText,
  referred_by_id: id.nullable(),
  post_id: id.nullable(),
  source_id: id.nullable(),
  contact_status: z.enum(CONTACT_STATUSES),
  next_follow_up_at: date,
  notes: optText,
};
export const personCreate = z.strictObject({
  ...personShape,
  company_id: personShape.company_id.optional(),
  referred_by_id: personShape.referred_by_id.optional(),
  post_id: personShape.post_id.optional(),
  source_id: personShape.source_id.optional(),
  contact_status: personShape.contact_status.optional(),
  next_follow_up_at: personShape.next_follow_up_at.optional(),
  ...labels,
});
export const personUpdate = patch(personShape).extend(labels);

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

/**
 * Temas ve taslağın muhatabı: kişi, firma ya da sadece adres/hesap (info@firma.com, @hesap).
 * Biri yeterli; kişi verilirse firma ve adres yok sayılır, firma verilirse adres yok sayılır.
 */
const subject = {
  person_id: id.nullish(),
  company_id: id.nullish(),
  contact: optText,
};
const needSubject = (d: { person_id?: number | null; company_id?: number | null; contact?: string | null }) => !!(d.person_id || d.company_id || d.contact);
const subjectMsg = { message: "kişi, firma ya da adres (contact) gerekli", path: ["person_id"] };

export const touchCreate = z.strictObject({
  ...subject,
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
});

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
const days = z.coerce.number().int().min(1).max(365);

export const postCreate = z.strictObject({
  platform: z.enum(POST_PLATFORMS),
  title: text,
  url: optText,
  body: optText,
  posted_at: date.optional(),
  refresh_days: days.nullish(),
  idea_id: id.nullish(),
  notes: optText,
});
export const postUpdate = patch({
  platform: z.enum(POST_PLATFORMS),
  title: text,
  url: optText,
  body: optText,
  posted_at: date,
  refresh_days: days.nullable(),
  idea_id: id.nullable(),
  notes: optText,
  /** true: "güncelledim" (yenileme tarihi bugün olur) */
  refreshed: z.boolean(),
});

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

export const taskCreate = z.strictObject({
  title: text,
  assignee: z.enum(ASSIGNEES).default("ozgur"),
  due_date: date.optional(),
  person_id: id.nullish(),
  company_id: id.nullish(),
  opportunity_id: id.nullish(),
  project_id: id.nullish(),
});
export const taskUpdate = patch({
  title: text,
  assignee: z.enum(ASSIGNEES),
  due_date: date,
  person_id: id.nullable(),
  company_id: id.nullable(),
  opportunity_id: id.nullable(),
  project_id: id.nullable(),
  done: z.boolean(),
});

export const commentCreate = z.strictObject({
  target_type: z.enum(COMMENT_TARGETS).optional(),
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

// ---- Günlük iş planı ----
/** Tekrar günleri: ISO numaraları dizisi (1 = pazartesi) ya da "her_gun" | "hafta_ici" | "hafta_sonu"; veritabanında virgüllü metin */
const goalDays = z.union([z.enum(Object.keys(GOAL_DAY_PRESETS) as [keyof typeof GOAL_DAY_PRESETS, ...(keyof typeof GOAL_DAY_PRESETS)[]]), z.array(z.coerce.number().int().min(1).max(7)).min(1)])
  .transform((v) => [...new Set(typeof v === "string" ? GOAL_DAY_PRESETS[v] : v)].sort().join(","));

export const goalCreate = z.strictObject({
  title: text,
  target: z.coerce.number().int().positive(),
  days: goalDays.default("1,2,3,4,5,6,7"),
  channel: z.enum(CHANNELS).nullish(),
  note: optText,
});
export const goalUpdate = patch({
  title: text,
  target: z.coerce.number().int().positive(),
  days: goalDays,
  channel: z.enum(CHANNELS).nullable(),
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
