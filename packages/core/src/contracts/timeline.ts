import type { Actor } from "../constants";

/** One row of the `events` table with its data decoded (what a record's own timeline lists) */
export interface TimelineEvent {
  id: number;
  type: string;
  person_id: number | null;
  opportunity_id: number | null;
  project_id: number | null;
  summary: string;
  data: unknown;
  created_by: Actor;
  created_at: string;
}

/** The kinds of the global feed (the type pills of the timeline screen): contact, payment, task, stage change, draft, comment */
export type FeedKind = "temas" | "odeme" | "gorev" | "asama" | "taslak" | "yorum";

/** The record a feed row belongs to (the chip of the row) */
export interface FeedRecord {
  /** record type as the panel knows it: person, company, opportunity, project, and for comments the type commented on */
  kind: string;
  id: number;
  name: string;
}

/** One row of the global feed, built from an event */
export interface FeedRow {
  /** the event id */
  id: number;
  type: FeedKind;
  created_by: Actor;
  created_at: string;
  /** local date of `created_at` as the server counts it, the key of the page's `day_counts` */
  day: string;
  /** the event's own summary line */
  text: string;
  /** TL, payments only */
  amount?: number;
  person_id?: number | null;
  company_id?: number | null;
  opportunity_id?: number | null;
  project_id?: number | null;
  /** project before opportunity before person before company; null when the event names none of them */
  rec: FeedRecord | null;
}

/** Query of the global feed; every field is optional and comes from the URL, so numbers and lists arrive as text */
export interface FeedQuery {
  /** cursor of the page before: the `next_before` of the previous page */
  before?: string;
  limit?: string | number;
  /** feed kinds, comma separated */
  type?: string;
  /** owner | claude */
  actor?: string;
  /** only events from this date (or time) on */
  since?: string;
  /** the summary, or the name of the person, opportunity or project the event names, contains this text (case insensitive for ASCII letters) */
  q?: string;
  /** only the events of one record, `person:12`: the links of the event, the row it points at, and comments on that record */
  record?: string;
}

/** Events of one local day, by who wrote them */
export interface DayCount {
  owner: number;
  claude: number;
}

/** A page of the feed, newest first; `next_before` is null on the last page */
export interface FeedPage {
  rows: FeedRow[];
  next_before: string | null;
  /** events per actor of every day the rows fall on, whatever the filters (the day headers) */
  day_counts: Record<string, DayCount>;
  /** rows matching the filters, only when `record` is asked for (the focus card) */
  total?: number;
}

/** The week strip of the timeline screen: Monday to Sunday against the week before, counted in SQL */
export interface WeekStrip {
  /** Monday of the week */
  start: string;
  /** feed rows written by the owner / by Claude */
  me: number;
  claude: number;
  touches: number;
  /** money received in the week by payment date (the projects module's ledger); null without that module */
  collections_amount: number | null;
  collections_count: number;
  tasks_done: number;
  claude_drafts: number;
  /** of those, the drafts the owner approved or sent */
  claude_drafts_approved: number;
  /** the same counts of the week before, for the "geçen hafta" lines */
  prev: { touches: number; tasks_done: number };
}

/**
 * Public API of the timeline module (`ctx.mod("timeline")`): the event history of one person, opportunity or project, the global feed
 * and the week strip. Which events show in the feed, and as what kind, is contributed by the modules that write them (`timelineKinds`).
 */
export interface TimelineApi {
  /** the last `limit` events of a person, opportunity or project, oldest first (type may be an alias, id a name) */
  forRecord(type: string, id: string | number, limit?: number): TimelineEvent[];
  feed(query?: FeedQuery): FeedPage;
  /** `start`: any date, the week it falls in is counted; default the current week */
  week(start?: string): WeekStrip;
}
