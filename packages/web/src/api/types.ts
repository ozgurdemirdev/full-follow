// REST yanıt tipleri (packages/core/src/services/queries.ts ile aynı alanlar)
import type { Actor, OppStage, ProjectStage } from "../lib/labels";

export interface List<T> {
  rows: T[];
  total: number;
}
export interface Mutation<T = unknown> {
  row?: T;
  effects?: string[];
}

interface Base {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: Actor;
}

export type ContactStatus = "yazilmadi" | "yazildi" | "cevap_geldi" | "gorusuldu" | "olumsuz" | "es_gecildi" | "tanidik" | "arkadas";
/** Kişi ve firmada ortak: etiketler (ad + id), sektörler, nereden buldum, temas durumu */
export interface Labeled {
  tags: string[];
  tag_ids: number[];
  sectors: { id: number; parent_id: number | null; path: string }[];
  sector_path: string | null;
  source_id: number | null;
  source_name: string | null;
  contact_status: ContactStatus;
}
export interface Person extends Base, Labeled {
  name: string;
  company_id: number | null;
  company_name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  linkedin: string | null;
  handle: string | null;
  referred_by_id: number | null;
  referred_by_name: string | null;
  referral_count: number;
  post_id: number | null;
  post_title: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  last_touch_at: string | null;
  last_channel: string | null;
  last_direction: "giden" | "gelen" | null;
  last_summary: string | null;
  days_since: number;
  awaiting: Awaiting | null;
  cooling: boolean;
  /** touches per ISO week, the last 12 weeks, oldest first */
  rhythm: number[];
}
/** Cevap bekleme: son gelen temastan sonra cevapsız giden temas */
export interface Awaiting {
  since: string;
  channel: string;
  days: number;
  attempts: number;
  late: boolean;
}
export interface Sector extends Base {
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  path: string;
  people_count: number;
  company_count: number;
  deleted_at: string | null;
}
export interface Tag extends Base {
  name: string;
  slug: string;
  color: string;
  deleted_at: string | null;
  people_count: number;
  company_count: number;
}
export interface TrashItem {
  type: string;
  id: number;
  label: string;
  what: string;
  deleted_at: string;
  deleted_by: Actor | null;
  trash_id: number | null;
}
export interface LinkRow extends Base {
  target_type: "opportunity" | "project" | "own_project";
  target_id: number;
  label: string;
  url: string;
  /** set when a project shows a link of its opportunity */
  from?: string;
}
export interface Note extends Base {
  person_id: number;
  person_name: string;
  body: string;
}
export interface ReferralValue {
  person_id: number;
  name: string;
  company_name: string | null;
  direct: number;
  network: number;
  opps: number;
  won: number;
  won_value: number;
  open_value: number;
  projects: number;
  collected: number;
}
export interface ChannelSummary {
  channel: string;
  total: number;
  out_count: number;
  in_count: number;
  last_at: string;
  awaiting: boolean;
}
export interface PersonCard {
  row: Person;
  channels: ChannelSummary[];
  touches: List<Touch>;
  notes: Note[];
  threads: Thread[];
  referrer: { id: number; name: string } | null;
  referrals: { id: number; name: string; company_name: string | null; tags: string[]; sector_path: string | null; opps: number; won: number; network: number }[];
  referral_value: ReferralValue | null;
  opportunities: Opportunity[];
  projects: Project[];
  drafts: Draft[];
  post: Post | null;
  ideas: Interest[];
}
export interface NetworkSettings {
  reply_wait_days: number;
  cooling_days: number;
  followup_days: number[];
  weekly_target: number;
  /** channel → daily outgoing message limit; a channel without an entry has no limit */
  channel_limits: Record<string, number>;
  /** ISO date or empty: cold email is off until then (inclusive) */
  email_warmup_until: string;
}
export type QuotaState = "ok" | "near" | "over";
export interface Quota {
  date: string;
  channels: { channel: string; sent: number; limit: number; state: QuotaState }[];
  email_warmup: { until: string | null; active: boolean };
}
export interface NetworkLists {
  awaiting: List<Person>;
  cooling: List<Person>;
  settings: NetworkSettings;
}

// ---- Paket 2: pazarlama ----
export type Platform = "r10" | "linkedin" | "instagram" | "diger";
export type IdeaStage = "fikir" | "dogrulaniyor" | "demo" | "urun";
export type InterestLevel = "anlatildi" | "ilgilendi" | "ilgilenmedi";
export interface Post extends Base {
  platform: Platform;
  title: string;
  url: string | null;
  body: string | null;
  posted_at: string;
  refresh_days: number | null;
  refreshed_at: string | null;
  idea_id: number | null;
  idea_title: string | null;
  notes: string | null;
  people_count: number;
  opp_count: number;
  won: number;
  won_value: number;
  next_refresh_at: string | null;
  refresh_due: boolean;
}
export interface Template extends Base {
  name: string;
  kind: "ilk" | "takip" | "teklif" | "diger";
  channel: string | null;
  sector_id: number | null;
  sector_path: string | null;
  body: string;
  used: number;
  sent: number;
  replied: number;
  reply_rate: number | null;
  /** too few sends to trust the rate */
  early: boolean;
  score?: number;
}
export interface TemplateSectorStat {
  sector_path: string;
  sent: number;
  replied: number;
  reply_rate: number;
  early: boolean;
}
export interface TemplateRank {
  id: number;
  name: string;
  sent: number;
  replied: number;
  reply_rate: number | null;
  early: boolean;
  /** best rate of its group, claimed only with at least two non-early templates */
  leader: boolean;
  sectors: TemplateSectorStat[];
}
/** Templates of the same kind and channel (channel null = all channels), ranked */
export interface TemplateGroup {
  kind: Template["kind"];
  channel: string | null;
  templates: TemplateRank[];
}
export interface Idea extends Base {
  title: string;
  problem: string | null;
  stage: IdeaStage;
  notes: string | null;
  sectors: { id: number; path: string }[];
  told: number;
  interested: number;
  not_interested: number;
  interest_rate: number | null;
  touch_count: number;
  post_count: number;
  post_people: number;
  /** sub idea grouping inside general ideas */
  parent_id: number | null;
  parent_title: string | null;
  child_count: number;
  /** own project this idea belongs to; null = general money idea */
  own_project_id: number | null;
  own_project_title: string | null;
  priority: IdeaPriority;
  position: number;
  done_at: string | null;
}
export type OwnProjectStatus = "aktif" | "beklemede" | "tamamlandi" | "birakildi";
export type Sellable = "evet" | "belki" | "hayir";
export type IdeaPriority = "yuksek" | "orta" | "dusuk";
export interface OwnProject extends Base {
  name: string;
  description: string | null;
  status: OwnProjectStatus;
  sellable: Sellable;
  sellable_note: string | null;
  notes: string | null;
  open_ideas: number;
  done_ideas: number;
  sectors: { id: number; path: string }[];
}
export interface Interest extends Base {
  idea_id: number;
  person_id: number;
  person_name: string;
  company_name: string | null;
  idea_title: string;
  idea_stage: IdeaStage;
  interest: InterestLevel;
  note: string | null;
  touch_id: number | null;
}
export interface FollowupDue {
  person_id: number | null;
  company_id: number | null;
  contact: string | null;
  name: string;
  company_name: string | null;
  channel: string;
  step: number;
  steps: number;
  days: number;
  attempts: number;
  since: string;
}
export interface Company extends Base, Labeled {
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  linkedin: string | null;
  notes: string | null;
  people_count: number;
  last_touch_at: string | null;
  touch_count: number;
  open_opps: number;
}
export interface CompanyCard {
  row: Company;
  people: Person[];
  touches: List<Touch>;
  opportunities: Opportunity[];
  drafts: Draft[];
  channels: Omit<ChannelSummary, "awaiting">[];
  threads: Thread[];
  source: { id: number; name: string } | null;
}
export interface Source extends Base {
  name: string;
  kind: string;
  notes: string | null;
  opp_count: number;
  people_count: number;
  company_count: number;
  deleted_at: string | null;
}
/** Extra person on an opportunity (the main contact is Opportunity.person_id) */
export interface OppPerson extends Base {
  opportunity_id: number;
  person_id: number;
  person_name: string;
  company_name: string | null;
  role: string;
  note: string | null;
}
export interface OfferItem {
  label: string;
  amount: number;
}
export interface Offer extends Base {
  opportunity_id: number;
  version: number;
  offered_at: string;
  amount: number;
  items: OfferItem[];
  note: string | null;
  accepted_at: string | null;
  file_id: number | null;
}
export interface FileRow extends Base {
  target_type: "opportunity" | "project";
  target_id: number;
  name: string;
  mime: string;
  size: number;
}
export interface Opportunity extends Base {
  title: string;
  person_id: number;
  person_name: string;
  company_id: number | null;
  company_name: string | null;
  source_id: number;
  source_name: string;
  source_url: string | null;
  source_date: string | null;
  stage: OppStage;
  estimated_value: number | null;
  lost_reason: string | null;
  next_follow_up_at: string | null;
  closed_at: string | null;
  position: number;
  project_id: number | null;
}
export interface Project extends Base {
  name: string;
  opportunity_id: number | null;
  person_id: number;
  person_name: string;
  stage: ProjectStage;
  price: number;
  started_at: string | null;
  delivered_at: string | null;
  maintenance_fee: number | null;
  paid_total: number;
  expected_total: number;
  next_payment: { id: number; milestone: string; remaining: number; due_date: string | null } | null;
  next_task: { id: number; title: string; due_date: string | null; assignee: Actor; created_by: Actor } | null;
}
export interface Task extends Base {
  title: string;
  assignee: Actor;
  due_date: string | null;
  due_time: string | null;
  kind: TaskKind;
  done_at: string | null;
  person_id: number | null;
  company_id: number | null;
  opportunity_id: number | null;
  project_id: number | null;
  person_name: string | null;
  company_name: string | null;
  opportunity_title: string | null;
  project_name: string | null;
}
export interface Draft extends Base {
  person_id: number | null;
  person_name: string | null;
  company_id: number | null;
  contact: string | null;
  /** muhatabın görünen adı: kişi, firma ya da adres */
  to_name: string;
  opportunity_id: number | null;
  project_id: number | null;
  channel: string;
  body: string;
  status: "bekliyor" | "onaylandi" | "gonderildi" | "reddedildi";
  reject_note: string | null;
  reason: string | null;
  template_id: number | null;
  followup_step: number | null;
}
export interface Payment extends Base {
  project_id: number;
  project_name: string;
  person_name: string;
  milestone: string;
  expected_amount: number;
  due_date: string | null;
  paid_amount: number;
  paid_at: string | null;
  status: "odendi" | "kismi" | "bekliyor" | "gecikmis";
}
export interface Touch extends Base {
  person_id: number | null;
  person_name: string | null;
  company_id: number | null;
  company_name: string | null;
  contact: string | null;
  /** muhatabın görünen adı: kişi, firma ya da adres */
  to_name: string;
  opportunity_id: number | null;
  project_id: number | null;
  channel: string;
  direction: "giden" | "gelen";
  kind: "mesaj" | "arama" | "gorusme";
  summary: string;
  outcome: string | null;
  happened_at: string;
  expects_reply: boolean;
  opportunity_title: string | null;
  draft_id: number | null;
  idea_id: number | null;
  idea_title: string | null;
}
export interface Comment extends Base {
  target_type: string;
  target_id: number;
  body: string;
  parent_id: number | null;
  resolved_at: string | null;
}
export interface Thread {
  id: number;
  target_type: string;
  target_id: number;
  target_label: string;
  resolved_at: string | null;
  count: number;
  last_id: number;
  last_by: Actor;
  last_at: string;
  last_body: string;
  comments?: Comment[];
}
export interface TimelineEvent {
  id: number;
  type: string;
  person_id: number | null;
  opportunity_id: number | null;
  project_id: number | null;
  summary: string;
  data: Record<string, unknown> | null;
  created_by: Actor;
  created_at: string;
}
export interface Today {
  date: string;
  /** day plan and tasks come from the calendar module: absent when it is not installed */
  plan?: Plan;
  comments: List<Thread>;
  drafts: List<Draft>;
  follow_ups: { people: List<Person>; opportunities: List<Opportunity> };
  tasks?: List<Task>;
  payments: List<Payment>;
  window_end: string;
  week: {
    start: string; sent: number; sent_prev: number; replies: number; replies_prev: number; meetings: number; offers: number; offers_silent: number;
    new_people: number; by_channel: { channel: string; sent: number; replies: number }[];
  };
  network: NetworkLists;
  /** posts whose refresh day has come; absent when the posts module is not installed */
  posts_due?: List<Post>;
  followups: List<FollowupDue>;
  quota: Quota;
  /** weekly review of the current week; ready on Fridays */
  review: { week: string; ready: boolean };
  claude_last_at: string | null;
}
export interface PriceFloor {
  bagkur_monthly: number;
  accounting_monthly: number;
  other_fixed_monthly: number;
  target_net_monthly: number;
  tax_rate_percent: number;
  payment_template: { milestone: string; percent: number; days: number }[];
  chat_pinned_notes: string;
  subtotal: number;
  floor: number;
}
export interface MonthReport {
  month: string;
  collected: number;
  outstanding_due: number;
  floor: number;
  floor_detail: PriceFloor;
  gap: number;
}
export interface SourceReport {
  source_id: number;
  source: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  won_value: number;
  conversion: number | null;
}
export interface MarketingReport {
  template_groups: TemplateGroup[];
}
/** Lead source funnel: found, written, replied, meeting, offer, won; rate = against the previous step */
export interface FunnelStep {
  key: string;
  count: number;
  rate: number | null;
}
export interface SourceFunnelRow {
  source_id: number;
  source: string;
  steps: FunnelStep[];
  reply_rate: number | null;
  /** too few written messages for the reply rate to mean much */
  early: boolean;
  weak: boolean;
}
export interface SourceFunnel {
  period: number | "all";
  since: string | null;
  sources: SourceFunnelRow[];
}
/** Weekly review (Friday summary) */
export interface ReviewWeek {
  sent: number;
  replies: number;
  meetings: number;
  reply_rate: number | null;
  new_people: number;
  new_companies: number;
  /** offers made that week */
  offers: number;
}
export interface ReviewPick {
  name: string;
  reply_rate: number | null;
}
export interface ReviewTemplate {
  kind: string;
  channel: string | null;
  leader: ReviewPick | null;
  loser: ReviewPick | null;
  /** templates with too few sends to rank */
  early: number;
}
export interface ReviewSuggestion {
  key: string;
  text: string;
  task_title: string;
}
export interface WeeklyReview {
  week: string;
  start: string;
  end: string;
  current: boolean;
  prev_week: string;
  next_week: string | null;
  /** weekly outgoing message target, 0 = off */
  target: number;
  this_week: ReviewWeek;
  last_week: ReviewWeek;
  templates: ReviewTemplate[];
  sources: { period: number | "all"; best: { source: string; reply_rate: number | null } | null; weakest: { source: string; reply_rate: number | null } | null };
  quota: { channel: string; limit: number; over_days: number; max_sent: number }[];
  suggestions: ReviewSuggestion[];
  /** due date of the tasks made from suggestions */
  next_monday: string;
}
export interface Report {
  sources: SourceReport[];
  month: MonthReport;
}
export interface Detail<T, R = { [k: string]: unknown[] | undefined }> {
  type: string;
  id: number;
  row: T;
  related: R;
  comments_open?: number;
}

// ---- Günlük iş planı ----
export interface GoalDay {
  id: number;
  title: string;
  target: number;
  channel: string | null;
  /** counts new people and companies by itself (instead of a channel) */
  metric: string | null;
  manual: number;
  auto: number;
  /** new records goals: duplicates skipped by bulk saves that day */
  duplicates: number;
  done: number;
  complete: boolean;
  note: string | null;
  goal_note: string | null;
}
export type TaskKind = "gorusme" | "takip" | "gorev";
export interface PlanTask {
  id: number;
  title: string;
  assignee: Actor;
  due_date: string | null;
  /** "HH:MM" or null (sometime that day) */
  due_time: string | null;
  kind: TaskKind;
  done_at: string | null;
}
/** A payment due on a calendar day */
export interface DuePayment {
  id: number;
  project_id: number;
  project_name: string;
  milestone: string;
  expected_amount: number;
  paid_amount: number;
  done: boolean;
}
/** A follow-up date of a person or an open opportunity */
export interface DueFollowUp {
  type: "person" | "opportunity";
  id: number;
  name: string;
  done: boolean;
}
export interface Plan {
  date: string;
  weekday: number;
  goals: GoalDay[];
  tasks: PlanTask[];
  streak: number;
  week_ratio: number | null;
}
export interface CalendarDay {
  date: string;
  goals: GoalDay[];
  tasks: Omit<PlanTask, "assignee">[];
  ratio: number | null;
  payments: DuePayment[];
  follow_ups: DueFollowUp[];
}
export interface Goal extends Base {
  title: string;
  target: number;
  days: string;
  channel: string | null;
  metric: string | null;
  note: string | null;
}

/** GET /stats/activity: buckets oldest first; drafts and offers are the ones created in the bucket */
export interface ActivityBucket {
  start: string;
  end: string;
  sent: number;
  replies: number;
  meetings: number;
  new_people: number;
  new_companies: number;
  drafts: number;
  offers: number;
}
export interface Activity {
  period: "day" | "week" | "month";
  buckets: ActivityBucket[];
  /** firms and people per contact status */
  status: Record<"people" | "companies", { status: string; count: number }[]>;
}
export type * from "./types-ideas";
