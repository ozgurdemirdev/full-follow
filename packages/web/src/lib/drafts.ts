// Drafts screen: tabs, reject reasons, how a draft reads (kind, handle, ages) and the motion values of the card stack
import type { Draft, Person, Touch } from "../api/types";
import type { BoardIconName } from "../components/boardIcons";
import { drafts as T } from "../styles/tokens.json";
import { daysFrom } from "./format";
import { CHANNELS as PERSON_CHANNELS } from "./people";

/** G12, not in core yet: the part of GET /settings the screen reads (learned rules from reject notes) */
export interface DraftRules {
  draft_rules?: string[];
}

export type DraftResult = "sent" | "rejected";
export type DraftTab = "pending" | DraftResult;

export const isPending = (d: Draft) => d.status === "bekliyor" || d.status === "onaylandi";
export const TABS: { key: DraftTab; label: string; test: (d: Draft) => boolean }[] = [
  { key: "pending", label: "Onay bekliyor", test: isPending },
  { key: "sent", label: "Gönderildi", test: (d) => d.status === "gonderildi" },
  { key: "rejected", label: "Reddedildi", test: (d) => d.status === "reddedildi" },
];

/** Reason chips of the reject panel; picking one fills the text field, which can then be edited */
export const REJECT_REASONS = ["Çok uzun", "Ton yanlış", "Zamanı değil", "Bilgi yanlış"];
/** Reason sent when the field is left empty (the reject call needs a note) */
export const REJECT_FALLBACK = "Neden yazılmadı";

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
export const draftKind = (d: Draft) => (d.followup_step ? `${d.followup_step}. takip` : "Taslak");

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
export const wordsLabel = (text: string) => `${wordCount(text)} kelime`;

/** Up to this many days an age reads in days, up to the next limit in weeks, then in months */
const WEEKS_FROM_DAYS = 14;
const MONTHS_FROM_DAYS = 30;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const MS_PER_HOUR = 3_600_000;

/** "2 gün", "3 hafta", "1 ay"; "dün" and "bugün" for the last two days */
export function shortAge(iso: string): string {
  const days = -daysFrom(iso);
  if (days <= 0) return "bugün";
  if (days === 1) return "dün";
  if (days < WEEKS_FROM_DAYS) return `${days} gün`;
  if (days < MONTHS_FROM_DAYS) return `${Math.floor(days / DAYS_PER_WEEK)} hafta`;
  return `${Math.floor(days / DAYS_PER_MONTH)} ay`;
}
/** Age of a draft change on the sent and rejected lists: "şimdi" within the hour */
export const historyAge = (iso: string) => (Date.now() - new Date(iso).getTime() < MS_PER_HOUR ? "şimdi" : shortAge(iso));

/** "Gelen: ...", "Giden: ..." line of a touch */
export const touchLine = (t: Touch) => `${t.direction === "gelen" ? "Gelen" : "Giden"}: ${t.summary}`;
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
