// The people screen: the "Bugün dokun" cards, the list filter, the warmth words and the next step of a row
import type { Person, Task } from "@kit/api/types";
import { daysFrom, fmtDay, followNote, todayIso, toDate } from "@kit/lib/format";
import { LOCALE } from "@kit/lib/i18n";
import { LUKEWARM_DAYS, WARM_DAYS, type PStatus } from "@kit/lib/people";
import { m as kit } from "@kit/messages";
import { m } from "./messages";

/** "Bugün dokun" shows at most this many cards */
export const TOUCH_CARDS = 4;
/** The list shows the date and time of a task as "Per 11:00" up to this many days ahead, then as a date */
const WEEKDAY_DAYS = 7;

export const STATUS_LABEL: Record<PStatus, string> = m.status;
/** Pill order of the list filter ("Hepsi" first) */
export const FILTERS: { key: "all" | Exclude<PStatus, "ok">; label: string }[] = [
  { key: "all", label: kit.all },
  { key: "due", label: m.filters.due },
  { key: "wait", label: m.filters.wait },
  { key: "cold", label: m.filters.cold },
  { key: "fresh", label: m.filters.fresh },
];

export type Warmth = "hot" | "mid" | "cold";
export const WARMTH_NAME: Record<Warmth, string> = m.warmth;
export const warmth = (days: number): Warmth => (days <= WARM_DAYS ? "hot" : days <= LUKEWARM_DAYS ? "mid" : "cold");

export const agoText = (days: number) => (days === 0 ? m.ago.today : days === 1 ? m.ago.yesterday : m.ago.days(days));

/** Bar level of a week: none, one touch, two or more */
export const rhythmLevel = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : 2);

/** One sentence on why the card is there */
export function whyText(p: Person, s: PStatus): string {
  if (s === "due") {
    const f = followNote(p.next_follow_up_at);
    return m.why.due(f?.late ? f.text : null, agoText(p.days_since));
  }
  if (s === "wait" && p.awaiting) {
    const a = p.awaiting;
    return m.why.wait(a.days, a.attempts);
  }
  return m.why.silent(p.days_since);
}

const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: "short" });
export interface NextStep {
  text: string;
  at: string;
  tone: "late" | "today" | "later";
}
/** The person's next step: the earliest open task, else the follow-up date */
export function nextStep(p: Person, tasks: Task[], today = todayIso()): NextStep | null {
  const own = tasks.filter((t) => t.person_id === p.id && t.due_date).sort((a, b) => (a.due_date! + (a.due_time ?? "")).localeCompare(b.due_date! + (b.due_time ?? "")))[0];
  const date = own?.due_date ?? p.next_follow_up_at;
  if (!date) return null;
  const d = daysFrom(date, today);
  const time = own?.due_time ? ` ${own.due_time}` : "";
  const at = d < 0 ? m.next.late : d === 0 ? `${kit.today}${time}` : d === 1 ? `${kit.tomorrow}${time}` : d < WEEKDAY_DAYS ? `${cap(weekday.format(toDate(date)))}${time}` : `${fmtDay(date)}${time}`;
  return { text: own?.title ?? m.next.followUp, at, tone: d < 0 ? "late" : d === 0 ? "today" : "later" };
}
const cap = (s: string) => s.charAt(0).toLocaleUpperCase(LOCALE) + s.slice(1);
