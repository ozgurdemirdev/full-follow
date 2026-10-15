import type { Channel, DraftStatus } from "../constants";
import type { ListOpts } from "../context";
import type { TouchRecord } from "./network";

/** A draft row as stored: the recipient is a person, a company or only an address (`contact`) */
export interface DraftRecord {
  id: number;
  person_id: number | null;
  company_id: number | null;
  contact: string | null;
  opportunity_id: number | null;
  project_id: number | null;
  channel: Channel;
  /** email subject line; null for the other channels */
  subject: string | null;
  body: string;
  status: DraftStatus;
  reject_note: string | null;
  /** why Claude proposed it (short) */
  reason: string | null;
  template_id: number | null;
  /** step of the follow-up sequence (1 = first follow-up) */
  followup_step: number | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** A draft as listed: the row plus the recipient's name */
export interface DraftRow extends DraftRecord {
  person_name: string | null;
  /** the company of the recipient: the company the draft is written to, or the company of its person (null without the companies module) */
  company_name: string | null;
  to_name: string | null;
}

/** A recipient whose follow-up is due and has no open draft yet */
export interface FollowupDue {
  /** the recipient: a person, a company or only an address (one of them is set) */
  person_id: number | null;
  company_id: number | null;
  contact: string | null;
  name: string;
  company_name: string | null;
  channel: string;
  /** 1 = first follow-up */
  step: number;
  steps: number;
  /** days since the first unanswered message */
  days: number;
  attempts: number;
  since: string;
}

/** A follow-up date on the calendar: a person or an open opportunity */
export interface FollowUpDate {
  type: "person" | "opportunity";
  id: number;
  name: string;
  /** an outgoing touch on or after the follow-up date */
  done: boolean;
  date: string;
}

/** ok = under the near threshold, near = close to the limit, over = limit reached or passed */
export type QuotaState = "ok" | "near" | "over";

export interface ChannelQuota {
  channel: Channel;
  sent: number;
  limit: number;
  state: QuotaState;
}

export interface Quota {
  date: string;
  /** only channels that have a daily limit, in channel order */
  channels: ChannelQuota[];
  /** cold email is off until `until` (inclusive) */
  email_warmup: { until: string | null; active: boolean };
}

/** Per limited channel over a range: on how many days the limit was reached or passed, and the most sent in a day */
export interface QuotaOverDays {
  channel: Channel;
  limit: number;
  over_days: number;
  max_sent: number;
}

/**
 * Public API of the drafts module (`ctx.mod("drafts")`): drafts Claude (or Özgür) leaves for approval, the follow-up sequence,
 * the daily send limits and the warnings when one is passed. Approving, rejecting and "sent" are Özgür's only. The inputs are the JSON the web and MCP send; they are validated inside.
 */
export interface DraftsApi {
  /** the text may be empty when a template is given (it is filled for the recipient); the recipient is a person, a company or an address */
  create(input: unknown): { row: DraftRecord; effects: string[] };
  /** only a waiting draft can be edited */
  update(id: number, input: unknown): { row: DraftRecord; effects: string[] };
  approve(id: number): { row: DraftRecord; effects: string[] };
  /** `{ note }` (the reason; it joins the learned rules) or `{ no_reason: true }` when none was given; a bare text counts as the note */
  reject(id: number, input: unknown): { row: DraftRecord; effects: string[] };
  /** "sent": the draft becomes sent and the outgoing touch is written through the network module (inside the same transaction) */
  markSent(id: number): { row: DraftRecord; touch?: TouchRecord; effects: string[] };
  /** a sent draft cannot be deleted (its touch hangs on it) */
  remove(id: number): { effects: string[]; trash: { type: string; id: number } };
  /** filters: status, person_id, company_id, company_scope (the company and its people), template_id, followup; q searches the text and the recipient; newest first */
  list(opts: ListOpts): { rows: DraftRow[]; total: number };
  get(id: number): DraftRow | undefined;
  followups: {
    /** recipients whose follow-up is due (an unanswered outgoing message, days passed, no open draft) */
    due(): FollowupDue[];
    /** leaves a draft for every due follow-up; asking again opens no second draft for the same step */
    generate(): { created: { draft_id: number; person_id: number | null; company_id: number | null; name: string; step: number }[]; effects: string[] };
  };
  /** outgoing messages per limited channel on a day against the daily limit, and the email warmup state */
  quota(date?: string): Quota;
  /** per limited channel over a range: days the limit was reached, the most sent in a day */
  quotaOverDays(from: string, to: string): QuotaOverDays[];
  /** outgoing messages per channel and day ("channel|date" to count); daily goals and the quota count from here */
  outgoingMessageCounts(from: string, to: string): Map<string, number>;
  /** follow-up dates of people and open opportunities in the range (the calendar feed) */
  followUpDates(from: string, to: string): FollowUpDate[];
  /** creation times of the drafts made on or after a date (the activity buckets count them) */
  createdSince(since: string): string[];
  /** links the drafts saved with only an address (listed by `keys`, "email:a@b.com") to the person or company just created with it */
  adoptLoose(owner: { person_id?: number; company_id?: number }, keys: string[]): void;
}
