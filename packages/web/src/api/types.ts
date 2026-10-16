// REST yanıt tipleri (packages/core/src/services/queries.ts ile aynı alanlar)
import type { Actor, PostFormat, ProjectStage, TaskAssignee } from "../lib/labels";
import type { ContactStatus } from "../../../core/src/constants";
import type {
  ActivityBucket, FollowupDue, GoalDay, InterestRow, IdeaStats, OfferItem, OpportunityRow, OwnProjectStats, PersonRow, PipelineMeta,
  PostPlatform, QuotaState, ReferralValue, TaskKind, CompanyRow, CompaniesOverview, CompanyOverviewRow, CompanyTotals, PeopleOverview, ReferralKpis,
} from "../../../core/src/contracts";

// Types that have exactly the shape of a core contract come from it (type only imports: nothing of core reaches the bundle).
// The rest of this file is the REST shape the web reads, which differs from the contract (narrower unions, extra fields).
export type { ActivityBucket, CompaniesOverview, CompanyOverviewRow, CompanyTotals, ContactStatus, PeopleOverview, ReferralKpis, FollowupDue, GoalDay, OfferItem, PipelineMeta, QuotaState, ReferralValue, TaskKind };
export type Person = PersonRow;
export type Company = CompanyRow;
export type Opportunity = OpportunityRow;
export type Idea = IdeaStats;
export type OwnProject = OwnProjectStats;
export type Interest = InterestRow;
export type Platform = PostPlatform;

export interface List<T> {
  rows: T[];
  total: number;
}
export interface Mutation<T = unknown> {
  row?: T;
  effects?: string[];
}

export interface Base {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: Actor;
}

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
export type IdeaStage ="fikir" | "dogrulaniyor" | "demo" | "urun";
export type InterestLevel = "anlatildi" | "ilgilendi" | "ilgilenmedi";
export interface Post extends Base {
  platform: Platform;
  title: string;
  url: string | null;
  body: string | null;
  posted_at: string;
  /** the post's own interval in days; null = the `post_refresh_days` setting decides */
  refresh_days: number | null;
  /** the interval in force: own, else the setting */
  refresh_every: number;
  refreshed_at: string | null;
  format: PostFormat | null;
  idea_id: number | null;
  idea_title: string | null;
  notes: string | null;
  people_count: number;
  opp_count: number;
  won: number;
  won_value: number;
  next_refresh_at: string;
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
  /** enough sends and a rate so low that the template should be retired */
  retire: boolean;
  /** one sentence about the template, written by the templates module; null when there is nothing to say */
  tip: string | null;
  score?: number;
}
export type OwnProjectStatus = "aktif" | "beklemede" | "tamamlandi" | "birakildi";
export type Sellable = "evet" | "belki" | "hayir";
export type IdeaPriority = "yuksek" | "orta" | "dusuk";
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
  /** pipeline module */
  opp_count?: number;
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
/** One part of an offer's payment plan: a project milestone and its share of the total, whole percent */
export interface OfferPlanPart {
  key: ProjectStage;
  label: string;
  pct: number;
}
export interface Offer extends Base {
  opportunity_id: number;
  version: number;
  offered_at: string;
  amount: number;
  items: OfferItem[];
  /** how the project's payments split once won; null = the payment template of the settings */
  plan: OfferPlanPart[] | null;
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
  idea_id: number | null;
  idea_title: string | null;
}
/** Task owner: the two actors, plus the client (musteri) */
export type { TaskAssignee };
export type ProjectTask = Omit<Task, "assignee"> & { assignee: TaskAssignee };
/** `GET /api/tasks/by-project` (calendar module): the tasks of one project; the name is null without the projects module */
export interface ProjectTaskGroup {
  project_id: number;
  project_name: string | null;
  tasks: ProjectTask[];
}
export interface Draft extends Base {
  person_id: number | null;
  person_name: string | null;
  company_id: number | null;
  /** the company of the recipient: the draft's own or its person's; null when it has none */
  company_name: string | null;
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
  /** email subject line; null for the other channels */
  subject: string | null;
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
  /** not provided yet (plan gap G8): the person or company an address-only touch most likely belongs to */
  suggested_match: { type: "person" | "company"; id: number; name: string } | null;
}
export interface Comment extends Base {
  target_type: string;
  target_id: number;
  body: string;
  parent_id: number | null;
  resolved_at: string | null;
  options: string[] | null; // quick answer chips of a Claude question
  read_at: string | null; // when the owner opened the thread; set on Claude comments, null while unread
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
/** `GET /api/today`: date, comments, window_end and claude_last_at always come; every other section is added by its module and is absent when that module is not installed */
export interface Today {
  date: string;
  /** calendar module */
  plan?: Plan;
  comments: List<Thread>;
  /** drafts module */
  drafts?: List<Draft>;
  /** the people module adds `people`, the pipeline module `opportunities` */
  follow_ups?: { people?: List<Person>; opportunities?: List<Opportunity> };
  /** calendar module */
  tasks?: List<Task>;
  /** projects module */
  payments?: List<Payment>;
  window_end: string;
  /** network module */
  week?: {
    start: string; sent: number; sent_prev: number; replies: number; replies_prev: number; meetings: number; offers: number; offers_silent: number;
    new_people: number; by_channel: { channel: string; sent: number; replies: number }[];
  };
  /** network module */
  network?: NetworkLists;
  /** posts whose refresh day has come; posts module */
  posts_due?: List<Post>;
  /** drafts module */
  followups?: List<FollowupDue>;
  /** drafts module */
  quota?: Quota;
  /** weekly review of the current week, ready on Fridays; reports module */
  review?: { week: string; ready: boolean };
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
  /** days after which a post without an interval of its own is due for a refresh */
  post_refresh_days: number;
  /** the own project in focus; null when none was picked or it is gone */
  focus_own_project_id: number | null;
  /** modules the owner hid in Settings (keys of installed modules); the shell reads it with the module list */
  modules_hidden?: string[];
  /** The owner's name, "" until the first run setup; absent on an older server */
  owner_name?: string;
  /** reject rules Claude learned, oldest first (PUT /settings { draft_rules } keeps the ones left in the list); absent when the drafts module is not installed */
  draft_rules?: string[];
  /** a draft request starts a background Claude run at once (else it becomes Claude's task); with its model and effort */
  draft_auto: boolean;
  draft_model: string;
  draft_effort: string;
  /** the panel chat's access: nothing asks (full authority), page reading, local files and the folders they reach */
  chat_full_access: boolean;
  chat_web_fetch: boolean;
  chat_local_files: boolean;
  chat_local_folders: string[];
}
/** One month of the report against the price floor (also the shape of the `month` of `GET /api/report`) */
export interface MonthReport {
  month: string;
  collected: number;
  outstanding_due: number;
  floor: number;
  floor_detail: PriceFloor;
  gap: number;
  /** one sentence about the month from the server; null for a coming month and while no floor is set */
  insight: string | null;
  /** opportunities lost in the month; null when the pipeline module is not installed */
  lost: { count: number; budget: number } | null;
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
/** `GET /api/report`: the conversion by source and the current month; several modules draw their cards from it */
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
  /** who made the latest change of the record (null until it has one); the edit sheet's "Son değişiklik" line */
  last_actor?: Actor | null;
}

// ---- Günlük iş planı ----
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
export interface Plan {
  date: string;
  weekday: number;
  goals: GoalDay[];
  tasks: PlanTask[];
  streak: number;
  week_ratio: number | null;
}

export interface Activity {
  period: "day" | "week" | "month";
  buckets: ActivityBucket[];
  /** firms and people per contact status */
  status: Record<"people" | "companies", { status: string; count: number }[]>;
}
export * from "./types-own";
