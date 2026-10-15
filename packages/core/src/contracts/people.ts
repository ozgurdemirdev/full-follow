import type { ContactStatus, Influence } from "../constants";
import type { ListOpts } from "../context";
import type { TouchDirection } from "./network";
import type { ReferralValue } from "./referrals";

/** A person row as stored (the duplicate keys are left out; they never leave the module) */
export interface PersonRecord {
  id: number;
  name: string;
  company_id: number | null;
  /** job title at the company (CEO, design); sectors describe the business, not the person */
  role: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  linkedin: string | null;
  handle: string | null;
  /** who introduced this person; the referral tree hangs on it */
  referred_by_id: number | null;
  /** the post this person came from */
  post_id: number | null;
  /** where the person was found (the lead source list) */
  source_id: number | null;
  contact_status: ContactStatus;
  next_follow_up_at: string | null;
  notes: string | null;
  /** role in a buying decision (null = not set) */
  influence: Influence | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** A person as listed: the row plus names, labels and the touch state (the touch parts are empty when the network module is missing) */
export interface PersonRow extends PersonRecord {
  company_name: string | null;
  referred_by_name: string | null;
  source_name: string | null;
  post_title: string | null;
  referral_count: number;
  tags: string[];
  tag_ids: number[];
  sectors: { id: number; parent_id: number | null; path: string }[];
  sector_path: string | null;
  last_touch_at: string | null;
  last_channel: string | null;
  last_direction: TouchDirection | null;
  last_summary: string | null;
  days_since: number;
  awaiting: { since: string; channel: string; days: number; attempts: number; late: boolean } | null;
  cooling: boolean;
  /** touches per ISO week of the last weeks, oldest first, the current week last */
  rhythm: number[];
}

/** A person in the referral tree */
export interface ReferralNode {
  id: number;
  name: string;
  referred_by_id: number | null;
  company_name: string | null;
}

/** Everything the person page shows, in one object */
export interface PersonCard {
  row: PersonRow;
  /** touch counts per channel (empty without the network module) */
  channels: any[];
  touches: { rows: any[]; total: number };
  notes: any[];
  threads: any[];
  referrer: { id: number; name: string | null } | null;
  referrals: any[];
  referral_value: ReferralValue | null;
  opportunities: any[];
  projects: any[];
  drafts: any[];
  post: any | null;
  ideas: any[];
}

/** Where a person sits on the people screen: a follow-up came due beats a reply that is awaited, beats a cooling relation, beats a new person */
export type PersonState = "due" | "wait" | "cold" | "fresh" | "ok";

/**
 * The people screen's page of the list: the rows of this page in screen order (by state), the number of rows after the filters (`total`),
 * and how many of them are in each state (`counts`, before the state filter).
 */
export interface PeopleOverview {
  rows: PersonRow[];
  total: number;
  counts: Record<"all" | Exclude<PersonState, "ok">, number>;
}

/**
 * Public API of the people module (`ctx.mod("people")`): people, their tags and sectors, contact status, the referral tree
 * and the person card. The inputs are the JSON the web and MCP send; they are validated inside.
 */
export interface PeopleApi {
  create(input: unknown): { row: PersonRecord; effects: string[] };
  update(id: number, input: unknown): { row: PersonRecord; effects: string[] };
  /** the person goes to the trash with its notes, drafts, comments, touches and tasks; a person with opportunities or projects stays */
  remove(id: number): { effects: string[]; trash: { type: string; id: number } };
  /** filters: ids (only these people), tag, sector, source, status, awaiting, cooling, channel, company_id, referred_by_id, post_id, follow_up_due */
  list(opts: ListOpts): { rows: PersonRow[]; total: number };
  get(id: number): PersonRow | undefined;
  /**
   * The list the people screen pages through. The `list` filters plus: state (due, wait, cold, fresh), has_channel (the person has an account on
   * linkedin, email, telefon or instagram), ids, company_ids and post_ids (comma separated). Sorted by state, then as `list` is.
   */
  overview(opts: ListOpts): PeopleOverview;
  /** What the whole book holds whatever the filters: people, and how many of them are cooling */
  summary(): { people: number; cooling: number };
  /** The people to reach out to first: by state, then the most overdue. Only the due, awaiting and cooling ones unless `all`; `exclude` leaves ids out */
  touchQueue(opts: { limit?: number; exclude?: number[]; all?: boolean }): PersonRow[];
  card(id: number): PersonCard;
  /** moves the person's contact status (and its company's) forward, never back; returns what changed */
  bumpStatus(id: number, next: ContactStatus): string[];
  /** every person with the introducer id: the tree the referrals module walks */
  referralTree(): ReferralNode[];
}
