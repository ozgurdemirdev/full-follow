import type { Actor } from "../lib/labels";

/** Event kinds of the timeline board, in the order of its type pills */
export type TlType = "temas" | "odeme" | "gorev" | "asama" | "taslak" | "yorum";

/** The record an event belongs to (the chip of a row, the target of the focus card) */
export interface TlRec {
  /** record type as the module links know it: person, company, opportunity, project, own_project, idea, post, template */
  kind: string;
  id: number;
  name: string;
}

/** One row of `GET /api/timeline` (the timeline module's feed) */
export interface TlRow {
  /** the event id */
  id: number;
  type: TlType;
  created_by: Actor;
  /** ISO instant, UTC */
  created_at: string;
  /** the server's local date of created_at: the key of day_counts */
  day: string;
  text: string;
  /** TL, payments only */
  amount?: number;
  rec: TlRec | null;
}

export interface TlDayCount {
  ozgur: number;
  claude: number;
}

/** A page of the feed, newest first; `next_before` is the cursor of the next page, null on the last one */
export interface TlPage {
  rows: TlRow[];
  next_before: string | null;
  /** every event of each day the rows fall on, whatever the filters (the day headers) */
  day_counts: Record<string, TlDayCount>;
  /** rows matching the filters, only when the request names a `record` */
  total?: number;
}

/** `GET /api/timeline/week` */
export interface TlWeekData {
  start: string;
  me: number;
  claude: number;
  touches: number;
  collections_amount: number;
  collections_count: number;
  tasks_done: number;
  claude_drafts: number;
  claude_drafts_approved: number;
  prev: { touches: number; tasks_done: number };
}

export interface TlWeekTile {
  type: TlType;
  label: string;
  value: string;
  sub: string;
}
export interface TlWeek {
  me: number;
  cl: number;
  tiles: TlWeekTile[];
}
