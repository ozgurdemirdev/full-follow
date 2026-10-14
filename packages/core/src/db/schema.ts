import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, uniqueIndex, index, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  ACTORS, SOURCE_KINDS, OPP_STAGES, CHANNELS, DIRECTIONS, TOUCH_KINDS,
  DRAFT_STATUSES, PROJECT_STAGES, MILESTONES, ASSIGNEES, COMMENT_TARGETS, LINK_TARGETS,
  TEMPLATE_KINDS, IDEA_STAGES, INTEREST_LEVELS,
  OPP_ROLES, FILE_TARGETS,
  TAG_COLORS, CONTACT_STATUSES, OWN_PROJECT_STATUSES, SELLABLE, IDEA_PRIORITIES,
  CHAT_ROLES, CHAT_STATES, CHAT_NEW_TITLE, CHAT_INPUT_MODES,
} from "../constants";

/** Her tabloda ortak alanlar */
const common = () => ({
  id: integer("id").primaryKey({ autoIncrement: true }),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
});

/** Kategori silinince yerinde gizlenir: kayıtlarda kalır, yenisine seçilemez (Çöp kutusundan geri gelir) */
const deletedAt = () => ({ deleted_at: text("deleted_at") });

/**
 * Mükerrer kontrol anahtarları (*_key): küçük harf, Türkçe karakter ve boşluk duyarsız, adresten kullanıcı adına
 * indirgenmiş değer (services/keys.ts). Ham alan değişince core yeniden hesaplar.
 */
export const companies = sqliteTable("companies", {
  ...common(),
  name: text("name").notNull(),
  website: text("website"),
  email: text("email"),
  phone: text("phone"),
  instagram: text("instagram"),
  linkedin: text("linkedin"),
  /** Nereden buldum (kaynak listesi) */
  source_id: integer("source_id").references((): AnySQLiteColumn => sources.id),
  contact_status: text("contact_status", { enum: CONTACT_STATUSES }).notNull().default("yazilmadi"),
  notes: text("notes"),
  name_key: text("name_key"),
  domain_key: text("domain_key"),
  email_key: text("email_key"),
  instagram_key: text("instagram_key"),
  linkedin_key: text("linkedin_key"),
}, (t) => [
  index("companies_name_key").on(t.name_key), index("companies_domain_key").on(t.domain_key), index("companies_email_key").on(t.email_key),
  index("companies_instagram_key").on(t.instagram_key), index("companies_linkedin_key").on(t.linkedin_key), index("companies_status").on(t.contact_status),
]);

export const people = sqliteTable("people", {
  ...common(),
  name: text("name").notNull(),
  company_id: integer("company_id").references(() => companies.id),
  /** Job title at the company (CEO, design); sectors describe the business, not the person */
  role: text("role"),
  email: text("email"),
  phone: text("phone"),
  instagram: text("instagram"),
  linkedin: text("linkedin"),
  handle: text("handle"),
  referred_by_id: integer("referred_by_id").references((): AnySQLiteColumn => people.id),
  /** Paket 2: kişiyi getiren paylaşım (kaynak) */
  post_id: integer("post_id").references((): AnySQLiteColumn => posts.id),
  /** Paket 3: nereden buldum (kaynak listesi) */
  source_id: integer("source_id").references((): AnySQLiteColumn => sources.id),
  contact_status: text("contact_status", { enum: CONTACT_STATUSES }).notNull().default("yazilmadi"),
  next_follow_up_at: text("next_follow_up_at"),
  notes: text("notes"),
  email_key: text("email_key"),
  instagram_key: text("instagram_key"),
  linkedin_key: text("linkedin_key"),
}, (t) => [
  index("people_follow_up").on(t.next_follow_up_at), index("people_referred").on(t.referred_by_id), index("people_post").on(t.post_id),
  index("people_company").on(t.company_id), index("people_email_key").on(t.email_key), index("people_instagram_key").on(t.instagram_key),
  index("people_linkedin_key").on(t.linkedin_key),
]);

/** İki seviyeli sektör: parent_id boşsa ana sektör (Sağlık), doluysa alt sektör (Diş hekimi) */
export const sectors = sqliteTable("sectors", {
  ...common(),
  name: text("name").notNull(),
  parent_id: integer("parent_id").references((): AnySQLiteColumn => sectors.id),
  ...deletedAt(),
}, (t) => [index("sectors_parent").on(t.parent_id)]);

/** Paket 3: etiketler (Ayarlar'dan eklenir, adı değişir, silinir). slug ilk addan türer ve değişmez. */
export const tags = sqliteTable("tags", {
  ...common(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  color: text("color", { enum: TAG_COLORS }).notNull().default("aday"),
  ...deletedAt(),
}, (t) => [uniqueIndex("tags_slug").on(t.slug)]);

export const company_tags = sqliteTable("company_tags", {
  company_id: integer("company_id").notNull().references(() => companies.id),
  tag_id: integer("tag_id").notNull().references(() => tags.id),
  created_at: text("created_at").notNull(),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
}, (t) => [primaryKey({ columns: [t.company_id, t.tag_id] }), index("company_tags_tag").on(t.tag_id)]);

export const person_sectors = sqliteTable("person_sectors", {
  person_id: integer("person_id").notNull().references(() => people.id),
  sector_id: integer("sector_id").notNull().references(() => sectors.id),
  created_at: text("created_at").notNull(),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
}, (t) => [primaryKey({ columns: [t.person_id, t.sector_id] }), index("person_sectors_sector").on(t.sector_id)]);

export const company_sectors = sqliteTable("company_sectors", {
  company_id: integer("company_id").notNull().references(() => companies.id),
  sector_id: integer("sector_id").notNull().references(() => sectors.id),
  created_at: text("created_at").notNull(),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
}, (t) => [primaryKey({ columns: [t.company_id, t.sector_id] }), index("company_sectors_sector").on(t.sector_id)]);

/**
 * Paket 3: çöp kutusu. Silinen kayıt ve onunla giden alt kayıtlar (temaslar, notlar, yorumlar...) payload'da
 * JSON olarak durur; geri yüklenince aynı id'lerle yerine konur. keys: mükerrer kontrolü için anahtarlar.
 */
export const trash = sqliteTable("trash", {
  ...common(),
  type: text("type").notNull(),
  record_id: integer("record_id").notNull(),
  label: text("label").notNull(),
  payload: text("payload").notNull(),
  keys: text("keys"),
}, (t) => [index("trash_type").on(t.type, t.record_id)]);

/** Kişi hakkında tarihli notlar (yorumdan farkı: cevap beklemez) */
export const notes = sqliteTable("notes", {
  ...common(),
  person_id: integer("person_id").notNull().references(() => people.id),
  body: text("body").notNull(),
}, (t) => [index("notes_person").on(t.person_id)]);

export const person_tags = sqliteTable("person_tags", {
  person_id: integer("person_id").notNull().references(() => people.id),
  tag_id: integer("tag_id").notNull().references(() => tags.id),
  created_at: text("created_at").notNull(),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
}, (t) => [primaryKey({ columns: [t.person_id, t.tag_id] }), index("person_tags_tag").on(t.tag_id)]);

/** Kaynaklar: fırsatın kaynağı ve kişi/firmanın "nereden buldum" alanı (aynı liste) */
export const sources = sqliteTable("sources", {
  ...common(),
  name: text("name").notNull(),
  kind: text("kind", { enum: SOURCE_KINDS }).notNull().default("diger"),
  notes: text("notes"),
  ...deletedAt(),
}, (t) => [uniqueIndex("sources_name").on(t.name)]);

export const opportunities = sqliteTable("opportunities", {
  ...common(),
  title: text("title").notNull(),
  person_id: integer("person_id").notNull().references(() => people.id),
  source_id: integer("source_id").notNull().references(() => sources.id),
  stage: text("stage", { enum: OPP_STAGES }).notNull().default("bulundu"),
  estimated_value: integer("estimated_value"),
  lost_reason: text("lost_reason"),
  next_follow_up_at: text("next_follow_up_at"),
  closed_at: text("closed_at"),
  position: integer("position").notNull().default(0),
  /** Paket 3: ilanın ya da konunun linki ve tarihi (R10 ilanı gibi) */
  source_url: text("source_url"),
  source_date: text("source_date"),
}, (t) => [index("opps_stage").on(t.stage, t.position), index("opps_person").on(t.person_id)]);

/**
 * Temasın muhatabı üçünden biri: kişi, firma (info@ gibi genel adres) ya da sadece adres/hesap (contact).
 * Sadece adresli temas, aynı adresle kişi ya da firma açılınca ona bağlanır (contact_key eşleşmesi).
 */
export const touches = sqliteTable("touches", {
  ...common(),
  person_id: integer("person_id").references(() => people.id),
  company_id: integer("company_id").references(() => companies.id),
  contact: text("contact"),
  contact_key: text("contact_key"),
  opportunity_id: integer("opportunity_id").references(() => opportunities.id),
  project_id: integer("project_id").references((): AnySQLiteColumn => projects.id),
  channel: text("channel", { enum: CHANNELS }).notNull(),
  direction: text("direction", { enum: DIRECTIONS }).notNull(),
  kind: text("kind", { enum: TOUCH_KINDS }).notNull().default("mesaj"),
  summary: text("summary").notNull(),
  outcome: text("outcome"),
  happened_at: text("happened_at").notNull(),
  /** giden temas cevap bekliyor mu (cevap bekleyenler listesi) */
  expects_reply: integer("expects_reply", { mode: "boolean" }).notNull().default(false),
  draft_id: integer("draft_id").references((): AnySQLiteColumn => drafts.id),
  /** Paket 2: temas bir ürün fikri hakkındaysa (ilgi ölçümü) */
  idea_id: integer("idea_id").references((): AnySQLiteColumn => ideas.id),
}, (t) => [
  index("touches_person").on(t.person_id, t.happened_at), index("touches_happened").on(t.happened_at),
  index("touches_company").on(t.company_id, t.happened_at), index("touches_contact").on(t.contact_key),
]);

/** Muhatap temastaki gibi: kişi, firma ya da sadece adres */
export const drafts = sqliteTable("drafts", {
  ...common(),
  person_id: integer("person_id").references(() => people.id),
  company_id: integer("company_id").references(() => companies.id),
  contact: text("contact"),
  opportunity_id: integer("opportunity_id").references(() => opportunities.id),
  project_id: integer("project_id").references((): AnySQLiteColumn => projects.id),
  channel: text("channel", { enum: CHANNELS }).notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: DRAFT_STATUSES }).notNull().default("bekliyor"),
  reject_note: text("reject_note"),
  /** Claude neden bu taslağı önerdi (kısa) */
  reason: text("reason"),
  /** Paket 2: kullanılan şablon ve takip dizisindeki adım (1 = ilk takip) */
  template_id: integer("template_id").references((): AnySQLiteColumn => templates.id),
  followup_step: integer("followup_step"),
});

export const projects = sqliteTable("projects", {
  ...common(),
  name: text("name").notNull(),
  opportunity_id: integer("opportunity_id").references(() => opportunities.id),
  person_id: integer("person_id").notNull().references(() => people.id),
  stage: text("stage", { enum: PROJECT_STAGES }).notNull().default("pesinat"),
  price: integer("price").notNull().default(0),
  started_at: text("started_at"),
  delivered_at: text("delivered_at"),
  maintenance_fee: integer("maintenance_fee"),
}, (t) => [uniqueIndex("projects_opportunity").on(t.opportunity_id)]);

export const payments = sqliteTable("payments", {
  ...common(),
  project_id: integer("project_id").notNull().references(() => projects.id),
  milestone: text("milestone", { enum: MILESTONES }).notNull(),
  expected_amount: integer("expected_amount").notNull(),
  due_date: text("due_date"),
  paid_amount: integer("paid_amount").notNull().default(0),
  paid_at: text("paid_at"),
}, (t) => [index("payments_project").on(t.project_id), index("payments_paid_at").on(t.paid_at)]);

export const tasks = sqliteTable("tasks", {
  ...common(),
  title: text("title").notNull(),
  assignee: text("assignee", { enum: ASSIGNEES }).notNull().default("ozgur"),
  due_date: text("due_date"),
  /** "HH:MM" on the due date; null = sometime that day */
  due_time: text("due_time"),
  /** gorusme | takip | gorev: the calendar module validates it */
  kind: text("kind").notNull().default("gorev"),
  done_at: text("done_at"),
  person_id: integer("person_id").references(() => people.id),
  company_id: integer("company_id").references(() => companies.id),
  opportunity_id: integer("opportunity_id").references(() => opportunities.id),
  project_id: integer("project_id").references(() => projects.id),
});

/** Kayıtlara yorum: kök yorum + cevaplar (parent_id = kök). Özgür ve Claude yazar. */
export const comments = sqliteTable("comments", {
  ...common(),
  target_type: text("target_type", { enum: COMMENT_TARGETS }).notNull(),
  target_id: integer("target_id").notNull(),
  body: text("body").notNull(),
  parent_id: integer("parent_id").references((): AnySQLiteColumn => comments.id),
  /** Sadece kök yorumda dolar: konu kapatıldı */
  resolved_at: text("resolved_at"),
}, (t) => [index("comments_target").on(t.target_type, t.target_id), index("comments_parent").on(t.parent_id)]);

/** Günlük iş planı: tekrarlı hedef (örn. günde 20 cold mail). channel doluysa o kanaldaki giden mesajlar kendiliğinden sayılır. */
export const daily_goals = sqliteTable("daily_goals", {
  ...common(),
  title: text("title").notNull(),
  target: integer("target").notNull(),
  /** ISO hafta günleri, virgüllü: "1,2,3,4,5" */
  days: text("days").notNull().default("1,2,3,4,5,6,7"),
  channel: text("channel", { enum: CHANNELS }),
  /** counts new records of the day by itself (instead of a channel); a goal has a channel or a metric, not both */
  metric: text("metric"),
  /** kalıcı not (örn. kişiye özel not yaz) */
  note: text("note"),
});

/** Hedefin bir günlük elle girilen sayısı ve o güne not */
export const goal_logs = sqliteTable("goal_logs", {
  ...common(),
  goal_id: integer("goal_id").notNull().references(() => daily_goals.id),
  date: text("date").notNull(),
  count: integer("count").notNull().default(0),
  note: text("note"),
}, (t) => [uniqueIndex("goal_logs_day").on(t.goal_id, t.date)]);

/** Labelled links on an opportunity or project (roadmap, proposal deck, Figma, repo) */
export const links = sqliteTable("links", {
  ...common(),
  target_type: text("target_type", { enum: LINK_TARGETS }).notNull(),
  target_id: integer("target_id").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
}, (t) => [index("links_target").on(t.target_type, t.target_id)]);

/** Extra people on an opportunity (decision maker, technical contact, partner); the main contact stays opportunities.person_id */
export const opportunityPeople = sqliteTable("opportunity_people", {
  ...common(),
  opportunity_id: integer("opportunity_id").notNull().references(() => opportunities.id),
  person_id: integer("person_id").notNull().references(() => people.id),
  role: text("role", { enum: OPP_ROLES }).notNull().default("diger"),
  note: text("note"),
}, (t) => [uniqueIndex("opp_people_pair").on(t.opportunity_id, t.person_id), index("opp_people_person").on(t.person_id)]);

/** Files uploaded to an opportunity or project; the bytes live on disk (data/files/<stored_name>), deleted rows go to the trash */
export const files = sqliteTable("files", {
  ...common(),
  target_type: text("target_type", { enum: FILE_TARGETS }).notNull(),
  target_id: integer("target_id").notNull(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  stored_name: text("stored_name").notNull(),
}, (t) => [index("files_target").on(t.target_type, t.target_id)]);

/** Offer versions of an opportunity; at most one is accepted (partial unique index) */
export const offers = sqliteTable("offers", {
  ...common(),
  opportunity_id: integer("opportunity_id").notNull().references(() => opportunities.id),
  version: integer("version").notNull(),
  offered_at: text("offered_at").notNull(),
  amount: integer("amount").notNull(),
  /** JSON array of { label, amount }: price breakdown or options */
  items: text("items").notNull().default("[]"),
  note: text("note"),
  accepted_at: text("accepted_at"),
  file_id: integer("file_id").references(() => files.id),
}, (t) => [
  index("offers_opp").on(t.opportunity_id, t.version),
  uniqueIndex("offers_one_accepted").on(t.opportunity_id).where(sql`${t.accepted_at} IS NOT NULL`),
]);

// ---------------------------------------------------------------- Paket 2: pazarlama

/** Paylaşımlar: R10 konusu, LinkedIn/Instagram gönderisi. Yenileme aralığı dolunca Bugün'de "güncelle" hatırlatması. */
export const posts = sqliteTable("posts", {
  ...common(),
  /** r10 | linkedin | instagram | diger: the posts module validates it */
  platform: text("platform").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  body: text("body"),
  posted_at: text("posted_at").notNull(),
  /** gün; boşsa hatırlatma yok */
  refresh_days: integer("refresh_days"),
  refreshed_at: text("refreshed_at"),
  idea_id: integer("idea_id").references((): AnySQLiteColumn => ideas.id),
  notes: text("notes"),
}, (t) => [index("posts_posted").on(t.posted_at)]);

/** Mesaj şablonları: kanal ve sektöre göre; boş kanal/sektör = hepsi */
export const templates = sqliteTable("templates", {
  ...common(),
  name: text("name").notNull(),
  kind: text("kind", { enum: TEMPLATE_KINDS }).notNull().default("ilk"),
  channel: text("channel", { enum: CHANNELS }),
  sector_id: integer("sector_id").references(() => sectors.id),
  body: text("body").notNull(),
});

/** Ürün fikirleri: sorun, aşama, hedef sektörler, anlatılan kişiler */
export const ideas = sqliteTable("ideas", {
  ...common(),
  title: text("title").notNull(),
  problem: text("problem"),
  stage: text("stage", { enum: IDEA_STAGES }).notNull().default("fikir"),
  notes: text("notes"),
  /** Sub idea grouping inside general ideas only (one level: a parent has no parent) */
  parent_id: integer("parent_id").references((): AnySQLiteColumn => ideas.id),
  /** Own project this idea belongs to; null = general money idea */
  own_project_id: integer("own_project_id").references((): AnySQLiteColumn => own_projects.id),
  /** Only meaningful inside a project */
  priority: text("priority", { enum: IDEA_PRIORITIES }).notNull().default("orta"),
  position: integer("position").notNull().default(0),
  done_at: text("done_at"),
}, (t) => [index("ideas_own_project").on(t.own_project_id, t.priority, t.position)]);

export const idea_sectors = sqliteTable("idea_sectors", {
  idea_id: integer("idea_id").notNull().references(() => ideas.id),
  sector_id: integer("sector_id").notNull().references(() => sectors.id),
  created_at: text("created_at").notNull(),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
}, (t) => [primaryKey({ columns: [t.idea_id, t.sector_id] })]);

// ---------------------------------------------------------------- Kendi projelerim

/** Own products Özgür builds for himself (Full Follow); not client work, no payments */
export const own_projects = sqliteTable("own_projects", {
  ...common(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: OWN_PROJECT_STATUSES }).notNull().default("aktif"),
  sellable: text("sellable", { enum: SELLABLE }).notNull().default("belki"),
  /** who could buy it and how */
  sellable_note: text("sellable_note"),
  notes: text("notes"),
}, (t) => [index("own_projects_status").on(t.status)]);

export const own_project_sectors = sqliteTable("own_project_sectors", {
  own_project_id: integer("own_project_id").notNull().references(() => own_projects.id),
  sector_id: integer("sector_id").notNull().references(() => sectors.id),
  created_at: text("created_at").notNull(),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
}, (t) => [primaryKey({ columns: [t.own_project_id, t.sector_id] }), index("own_project_sectors_sector").on(t.sector_id)]);

/** Fikir kime anlatıldı, ilgilendi mi (kişi başına bir satır) */
export const idea_people = sqliteTable("idea_people", {
  ...common(),
  idea_id: integer("idea_id").notNull().references(() => ideas.id),
  person_id: integer("person_id").notNull().references(() => people.id),
  interest: text("interest", { enum: INTEREST_LEVELS }).notNull().default("anlatildi"),
  note: text("note"),
  touch_id: integer("touch_id").references(() => touches.id),
}, (t) => [uniqueIndex("idea_people_pair").on(t.idea_id, t.person_id), index("idea_people_person").on(t.person_id)]);

/** Zaman çizelgesi; kayıt silinse de olay kalır (FK yok) */
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  person_id: integer("person_id"),
  opportunity_id: integer("opportunity_id"),
  project_id: integer("project_id"),
  summary: text("summary").notNull(),
  data: text("data"),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
  created_at: text("created_at").notNull(),
}, (t) => [index("events_person").on(t.person_id), index("events_opp").on(t.opportunity_id), index("events_project").on(t.project_id)]);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updated_at: text("updated_at").notNull(),
  updated_by: text("updated_by", { enum: ACTORS }).notNull(),
});

// ---------------------------------------------------------------- Panel chat

export const chat_sessions = sqliteTable("chat_sessions", {
  ...common(),
  ...deletedAt(),
  title: text("title").notNull().default(CHAT_NEW_TITLE),
  /** 1 after a manual rename: the auto title stops changing */
  title_locked: integer("title_locked", { mode: "boolean" }).notNull().default(false),
  /** UUID handed to the Claude CLI: --session-id on the first run, --resume afterwards */
  cli_session_id: text("cli_session_id").notNull().unique(),
  cli_started: integer("cli_started", { mode: "boolean" }).notNull().default(false),
  /** version (hash) of the pinned notes this chat last saw; a resumed CLI session ignores a changed system prompt, so a change is sent as a hidden block */
  notes_version: text("notes_version").notNull().default(""),
  model: text("model").notNull(),
  effort: text("effort").notNull(),
  context_tokens: integer("context_tokens").notNull().default(0),
  input_tokens_total: integer("input_tokens_total").notNull().default(0),
  output_tokens_total: integer("output_tokens_total").notNull().default(0),
  cost_usd_micros_total: integer("cost_usd_micros_total").notNull().default(0),
  last_message_at: text("last_message_at"),
}, (t) => [index("chat_sessions_list").on(t.deleted_at, t.last_message_at)]);

export const chat_messages = sqliteTable("chat_messages", {
  ...common(),
  session_id: integer("session_id").notNull().references(() => chat_sessions.id),
  role: text("role", { enum: CHAT_ROLES }).notNull(),
  /** assistant body grows while streaming */
  body: text("body").notNull().default(""),
  state: text("state", { enum: CHAT_STATES }).notNull(),
  /** browser UUID, user rows only; unique per session so a retried send is idempotent */
  client_id: text("client_id"),
  /** user rows only: "voice" when the text was dictated (the CLI then gets a hidden note, never stored in body) */
  /** assistant rows only: the reply started with [[ack]] (Claude acknowledged instead of answering); the marker itself is never stored */
  ack: integer("ack", { mode: "boolean" }).notNull().default(false),
  input_mode: text("input_mode", { enum: CHAT_INPUT_MODES }).notNull().default("text"),
  tools_json: text("tools_json"),
  error: text("error"),
  input_tokens: integer("input_tokens"),
  output_tokens: integer("output_tokens"),
  cost_usd_micros: integer("cost_usd_micros"),
}, (t) => [index("chat_messages_session").on(t.session_id, t.id), uniqueIndex("chat_messages_client").on(t.session_id, t.client_id)]);

/** Files attached to a chat message; message_id stays null until the message is sent. Files live on disk under data/chat/uploads. */
export const chat_attachments = sqliteTable("chat_attachments", {
  ...common(),
  session_id: integer("session_id").notNull().references(() => chat_sessions.id),
  message_id: integer("message_id").references(() => chat_messages.id),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
}, (t) => [index("chat_attachments_message").on(t.message_id), index("chat_attachments_session").on(t.session_id)]);
