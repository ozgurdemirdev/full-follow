// Drafts screen: tabs, reject reasons, how a draft reads (kind, handle, ages) and the motion values of the card stack
import type { Draft, Person, Touch } from "@kit/api/types";
import type { BoardIconName } from "@kit/components/boardIcons";
import { drafts as T } from "@kit/styles/tokens.json";
import { daysFrom } from "@kit/lib/format";
import { CHANNELS as PERSON_CHANNELS } from "@kit/lib/people";
import { m } from "./messages";

/** The part of GET /settings the screen reads (learned rules from reject notes) */
export interface DraftRules {
  draft_rules?: string[];
}

export type DraftResult = "sent" | "rejected";
export type DraftTab = "pending" | DraftResult;

export const isPending = (d: Draft) => d.status === "bekliyor" || d.status === "onaylandi";
export const TABS: { key: DraftTab; label: string; test: (d: Draft) => boolean }[] = [
  { key: "pending", label: m.tabs.pending, test: isPending },
  { key: "sent", label: m.tabs.sent, test: (d) => d.status === "gonderildi" },
  { key: "rejected", label: m.tabs.rejected, test: (d) => d.status === "reddedildi" },
];

/** Reason chips of the reject panel; picking one fills the text field, which can then be edited */
export const REJECT_REASONS = [m.reasons.tooLong, m.reasons.wrongTone, m.reasons.notNow, m.reasons.wrongInfo];

/** The side card lists this many of the latest touches with the person */
export const SIDE_TOUCHES = 2;
/** The sent and rejected lists show this many rows until "Daha fazla" is pressed */
export const HISTORY_PAGE = 50;

/** Icon of a channel; channels the boards have no icon for read as a speech bubble */
const CHANNEL_ICON: Record<string, BoardIconName> = Object.fromEntries(PERSON_CHANNELS.map((c) => [c.key, c.icon]));
export const channelIcon = (channel: string): BoardIconName => CHANNEL_ICON[channel] ?? "comment";

/** The address the draft goes to: the one typed on the draft, else the person's account in that channel */
export function handleOf(d: Draft, person?: Person): string {
  if (d.contact) return d.contact;
  if (!person) return "";
  const own = PERSON_CHANNELS.find((c) => c.key === d.channel)?.handle(person);
  return own ?? (d.channel === "whatsapp" ? person.phone ?? "" : "");
}

/** Label of the kind chip: the follow-up step when the draft comes from the follow-up sequence */
export const draftKind = (d: Draft) => (d.followup_step ? m.followup(d.followup_step) : m.noun);

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
export const wordsLabel = (text: string) => m.words(wordCount(text));

/** The company shown next to the recipient: none when the recipient is the company itself */
export const companyOf = (d: Draft) => (d.company_name && d.company_name !== d.to_name ? d.company_name : null);

/** What "Kopyala" puts on the clipboard: the subject line above the text when the draft has one */
export const copyTextOf = (subject: string, text: string) => (subject.trim() ? m.copyText(subject.trim(), text) : text);
/** Only an email has a subject line: its field shows while editing (any draft that already has a subject keeps it) */
export const SUBJECT_CHANNEL = "email";

/** Up to this many days an age reads in days, up to the next limit in weeks, then in months */
const WEEKS_FROM_DAYS = 14;
const MONTHS_FROM_DAYS = 30;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const MS_PER_HOUR = 3_600_000;

/** "2 gün", "3 hafta", "1 ay"; "dün" and "bugün" for the last two days */
export function shortAge(iso: string): string {
  const days = -daysFrom(iso);
  if (days <= 0) return m.age.today;
  if (days === 1) return m.age.yesterday;
  if (days < WEEKS_FROM_DAYS) return m.age.days(days);
  if (days < MONTHS_FROM_DAYS) return m.age.weeks(Math.floor(days / DAYS_PER_WEEK));
  return m.age.months(Math.floor(days / DAYS_PER_MONTH));
}
/** Age of a draft change on the sent and rejected lists: "şimdi" within the hour */
export const historyAge = (iso: string) => (Date.now() - new Date(iso).getTime() < MS_PER_HOUR ? m.age.now : shortAge(iso));

/** "Gelen: ...", "Giden: ..." line of a touch */
export const touchLine = (t: Touch) => m.touch.line(t.direction === "gelen" ? m.touch.incoming : m.touch.outgoing, t.summary);
export const byRecent = (a: Touch, b: Touch) => b.happened_at.localeCompare(a.happened_at);

// ------------------------------------------------------------ card stack motion (values come from tokens.json)
export const STACK = {
  leaveX: T["leave-x"],
  leaveRotate: T["leave-rotate"],
  enterY: T["enter-y"],
  enterScale: T["enter-scale"],
  /** the next two drafts show behind the top card */
  peeks: [T["peek-near"], T["peek-far"]],
};

/** The drafts of one status (the screen reads the waiting and approved ones whole, the sent and rejected ones page by page) */
export const draftsOf = (status: Draft["status"]) => `/drafts?status=${status}`;
