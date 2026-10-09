import { sqliteTable, text, integer, primaryKey, uniqueIndex, index, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import {
  ACTORS, TAGS, SOURCE_KINDS, OPP_STAGES, CHANNELS, DIRECTIONS, TOUCH_KINDS,
  DRAFT_STATUSES, PROJECT_STAGES, MILESTONES, ASSIGNEES, COMMENT_TARGETS,
} from "../constants";

/** Her tabloda ortak alanlar */
const common = () => ({
  id: integer("id").primaryKey({ autoIncrement: true }),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
});

export const companies = sqliteTable("companies", {
  ...common(),
  name: text("name").notNull(),
  website: text("website"),
  notes: text("notes"),
});

export const people = sqliteTable("people", {
  ...common(),
  name: text("name").notNull(),
  company_id: integer("company_id").references(() => companies.id),
  email: text("email"),
  phone: text("phone"),
  handle: text("handle"),
  referred_by_id: integer("referred_by_id").references((): AnySQLiteColumn => people.id),
  next_follow_up_at: text("next_follow_up_at"),
  notes: text("notes"),
}, (t) => [index("people_follow_up").on(t.next_follow_up_at)]);

export const person_tags = sqliteTable("person_tags", {
  person_id: integer("person_id").notNull().references(() => people.id),
  tag: text("tag", { enum: TAGS }).notNull(),
  created_at: text("created_at").notNull(),
  created_by: text("created_by", { enum: ACTORS }).notNull(),
}, (t) => [primaryKey({ columns: [t.person_id, t.tag] })]);

export const sources = sqliteTable("sources", {
  ...common(),
  name: text("name").notNull(),
  kind: text("kind", { enum: SOURCE_KINDS }).notNull().default("diger"),
  notes: text("notes"),
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
}, (t) => [index("opps_stage").on(t.stage, t.position), index("opps_person").on(t.person_id)]);

export const touches = sqliteTable("touches", {
  ...common(),
  person_id: integer("person_id").notNull().references(() => people.id),
  opportunity_id: integer("opportunity_id").references(() => opportunities.id),
  project_id: integer("project_id").references((): AnySQLiteColumn => projects.id),
  channel: text("channel", { enum: CHANNELS }).notNull(),
  direction: text("direction", { enum: DIRECTIONS }).notNull(),
  kind: text("kind", { enum: TOUCH_KINDS }).notNull().default("mesaj"),
  summary: text("summary").notNull(),
  outcome: text("outcome"),
  happened_at: text("happened_at").notNull(),
  draft_id: integer("draft_id").references((): AnySQLiteColumn => drafts.id),
}, (t) => [index("touches_person").on(t.person_id, t.happened_at)]);

export const drafts = sqliteTable("drafts", {
  ...common(),
  person_id: integer("person_id").notNull().references(() => people.id),
  opportunity_id: integer("opportunity_id").references(() => opportunities.id),
  project_id: integer("project_id").references((): AnySQLiteColumn => projects.id),
  channel: text("channel", { enum: CHANNELS }).notNull(),
  body: text("body").notNull(),
  status: text("status", { enum: DRAFT_STATUSES }).notNull().default("bekliyor"),
  reject_note: text("reject_note"),
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
  done_at: text("done_at"),
  person_id: integer("person_id").references(() => people.id),
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
