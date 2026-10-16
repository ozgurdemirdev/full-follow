import type { ListOpts } from "../context";
import type { Q } from "../db/client";

export type TouchChannel = "email" | "instagram" | "linkedin" | "telefon" | "yuz_yuze" | "whatsapp" | "r10" | "diger";
export type TouchDirection = "giden" | "gelen";
export type TouchKind = "mesaj" | "arama" | "gorusme";

/** A touch row as stored: one message, call or meeting with a person, a company or a bare address */
export interface TouchRecord {
  id: number;
  person_id: number | null;
  company_id: number | null;
  /** bare address or account (info@firma.com, @hesap) when no person or company is known yet */
  contact: string | null;
  contact_key: string | null;
  opportunity_id: number | null;
  project_id: number | null;
  channel: TouchChannel;
  direction: TouchDirection;
  kind: TouchKind;
  summary: string;
  outcome: string | null;
  happened_at: string;
  /** an outgoing message waits for an answer unless this is cleared */
  expects_reply: boolean;
  draft_id: number | null;
  idea_id: number | null;
  created_at: string;
  updated_at: string;
  created_by: "owner" | "claude";
}

/** The person or company a loose touch's address belongs to, found among the records that exist */
export interface TouchMatch {
  type: "person" | "company";
  id: number;
  name: string;
}

/** A touch as listed: the row plus the names of what it hangs on and, for a loose touch, the record its address points at */
export interface TouchListRow extends Omit<TouchRecord, "contact_key"> {
  person_name: string | null;
  company_name: string | null;
  to_name: string | null;
  opportunity_title: string | null;
  idea_title: string | null;
  /** only loose touches (no person, no company) can have one; null when nothing matches */
  suggested_match: TouchMatch | null;
}

/** Who a touch is about, after resolving the input: a person, else a company, else a bare address */
export interface TouchSubject {
  person_id: number | null;
  company_id: number | null;
  contact: string | null;
  contact_key: string | null;
}

/** What `touches.insert` takes: the validated create input plus the draft the touch was sent from */
export interface TouchInput {
  person_id?: number | null;
  company_id?: number | null;
  contact?: string | null;
  opportunity_id?: number | null;
  project_id?: number | null;
  channel: TouchChannel;
  direction: TouchDirection;
  kind: TouchKind;
  summary: string;
  outcome?: string | null;
  happened_at?: string;
  expects_reply?: boolean;
  idea_id?: number | null;
  draft_id?: number | null;
}

/** Event `touch.created`: a touch row was just written, inside the same transaction. A hook returns effect strings. */
export interface TouchCreated {
  touch: TouchRecord;
  subject: TouchSubject;
  /** the first email to this recipient (worked out before the row existed); the send warnings need it */
  cold: boolean;
  input: Pick<TouchInput, "channel" | "direction" | "kind" | "idea_id">;
}

/** Event `touch.updated`: a touch was edited (summary, kind, answer flag, idea link); the row is the edited one */
export interface TouchUpdated {
  touch: TouchRecord;
  /** the fields that were sent */
  changes: Partial<Pick<TouchInput, "channel" | "kind" | "summary" | "outcome" | "happened_at" | "expects_reply" | "idea_id">>;
}

/** What a person's touches say, computed and never stored */
export interface PersonNet {
  last_touch_at: string | null;
  last_channel: string | null;
  last_direction: TouchDirection | null;
  /** text of the last touch */
  last_summary: string | null;
  last_in_at: string | null;
  /** days since the last touch (since the record was added when there is none) */
  days_since: number;
  /** an outgoing touch that waits for an answer after the last incoming one */
  awaiting: { since: string; channel: string; days: number; attempts: number; late: boolean } | null;
  cooling: boolean;
}

/** Touch counts per channel of one person or company */
export interface ChannelSummary {
  channel: string;
  total: number;
  out_count: number;
  in_count: number;
  last_at: string;
  /** the person waits for an answer on this channel */
  awaiting?: boolean;
}

/** The two lists of the Today view: people waiting for an answer and connections that went cold */
export interface NetworkLists {
  awaiting: { rows: any[]; total: number };
  cooling: { rows: any[]; total: number };
  settings: Record<string, unknown>;
}

interface WeekBucket {
  sent: number;
  replies: number;
  meetings: number;
  reply_rate: number | null;
  new_people: number;
  new_companies: number;
}

/** Touch counts of this week and the last, by channel, plus the open offers */
export interface WeekStats {
  week_start: string;
  this_week: WeekBucket;
  last_week: WeekBucket;
  by_channel: { channel: string; sent: number; replies: number }[];
  open_offers: number;
  silent_offers: number;
}

export interface ActivityBucket {
  start: string;
  end: string;
  sent: number;
  replies: number;
  meetings: number;
  new_people: number;
  new_companies: number;
  /** drafts and offers created in the bucket (any status) */
  drafts: number;
  offers: number;
}

/** Dashboard chart data: per day, week or month buckets (oldest first), the last bucket by channel, and the contact status spread */
export interface ActivityReport {
  period: "day" | "week" | "month";
  buckets: ActivityBucket[];
  current: ActivityBucket;
  previous: ActivityBucket | null;
  channels: { channel: string; sent: number; replies: number }[];
  status: { people: { status: string; count: number }[]; companies: { status: string; count: number }[] };
}

/**
 * Public API of the network module (`ctx.mod("network")`): touches (messages, calls, meetings), the weekly numbers,
 * who waits for an answer and who went cold. The inputs are the JSON the web and MCP send; they are validated inside.
 */
export interface NetworkApi {
  touches: {
    /** writes the touch, moves the contact status of the person and company forward and emits `touch.created` */
    create(input: unknown): { row: TouchRecord; effects: string[] };
    /** `q` is the transaction the caller is in (a draft marked as sent writes its touch inside its own transaction) */
    insert(q: Q, input: TouchInput): { row: TouchRecord; effects: string[] };
    /**
     * summary, outcome, channel, kind, date, the answer flag and the idea link; emits `touch.updated`.
     * `person_id` or `company_id` moves a loose touch (one saved with only an address) to that record; any other touch keeps its subject.
     */
    update(id: number, input: unknown): { row: TouchRecord; effects: string[] };
    /**
     * Moves the loose touches that have a suggested match to it (the person or company their address points at), in one transaction.
     * `contact` limits it to one address as written on the touch; without it every loose touch with a suggestion moves. Writes an event per touch.
     */
    adoptSuggested(input?: unknown): { adopted: number; effects: string[] };
    remove(id: number): { effects: string[]; trash: { type: string; id: number } };
    /** filters: person_id, company_id, company_scope (the company and its people), opportunity_id, project_id, idea_id, channel, loose */
    list(opts: ListOpts): { rows: TouchListRow[]; total: number };
    get(id: number): TouchListRow | undefined;
  };
  /** every person's touch state in one query; `ids` computes it only for those people */
  stats(ids?: number[]): Map<number, PersonNet>;
  /** touches per ISO week of the last weeks for every person that has any (or only for `ids`), oldest week first */
  rhythm(ids?: number[]): Map<number, number[]>;
  /** touch counts of one person by channel; `net.awaiting` marks the channel that waits for an answer */
  channels(personId: number, net?: Pick<PersonNet, "awaiting">): ChannelSummary[];
  /** touch counts by channel of a company and its people */
  companyChannels(companyId: number): ChannelSummary[];
  /** people waiting for an answer and connections that went cold */
  lists(limit?: number): NetworkLists;
  /** weekly numbers; `ref` is any day of the week asked for (today by default) */
  weekStats(ref?: string): WeekStats;
  activity(period?: string): ActivityReport;
  /**
   * Links the touches (and drafts) saved with only an address (info@, @account) to a person or company just created with that address;
   * returns the effects.
   */
  adoptLoose(owner: { person_id?: number; company_id?: number }, keys: string[]): string[];
}
