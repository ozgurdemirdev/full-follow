import type { CalendarDay, DueFollowUp, DuePayment, PlanTask, TaskKind } from "../api/types";
import { recordPath } from "../app/routes";
import { addDaysIso, lira, toDate } from "./format";
import { MILESTONE } from "./labels";

/** What an item of the calendar is: a meeting, a follow-up, a payment or a plain task */
export type Kind = "meet" | "follow" | "pay" | "task";

export const KINDS: { key: Kind; label: string; dot: string }[] = [
  { key: "meet", label: "Görüşme", dot: "bg-kind-meet" },
  { key: "follow", label: "Takip", dot: "bg-kind-follow" },
  { key: "pay", label: "Ödeme", dot: "bg-kind-pay" },
  { key: "task", label: "Görev", dot: "bg-kind-task" },
];
export const KIND = Object.fromEntries(KINDS.map((k) => [k.key, k])) as Record<Kind, (typeof KINDS)[number]>;

/** Task kinds of the core, as the calendar kinds */
export const OF_TASK_KIND: Record<TaskKind, Kind> = { gorusme: "meet", takip: "follow", gorev: "task" };
/** Time column of an item without a time */
export const ANYTIME = "Gün içi";
/** A goal below this share of its target is shown as behind */
export const GOAL_BEHIND = 0.66;
const DAYS_IN_WEEK = 7;

export interface CalItem {
  key: string;
  time: string | null;
  title: string;
  kind: Kind;
  done: boolean;
  /** text after the kind name: " · ₺18.000" */
  extra: string;
  /** what ticking the item does; follow-ups are ticked by writing to the person instead */
  tick: { type: "task"; id: number } | { type: "payment"; id: number; amount: number } | null;
  /** the record behind a follow-up */
  href?: string;
}

type DayTask = Omit<PlanTask, "assignee">;

/** The day's items, timed ones first by time, then the ones without time (tasks, payments, follow-ups) */
export function itemsOf(date: string, tasks: DayTask[], payments: DuePayment[], followUps: DueFollowUp[], today: string): CalItem[] {
  const fromTask = (t: DayTask): CalItem => ({
    key: `t${t.id}`, time: t.due_time, title: t.title, kind: OF_TASK_KIND[t.kind], done: !!t.done_at, tick: { type: "task", id: t.id },
    extra: t.due_date && t.due_date < date && !t.done_at ? ` · ${shortDate(t.due_date)} tarihliydi` : "",
  });
  const fromPayment = (p: DuePayment): CalItem => {
    const left = p.expected_amount - p.paid_amount;
    return {
      key: `p${p.id}`, time: null, title: `${p.project_name} ${MILESTONE[p.milestone] ?? p.milestone}`, kind: "pay", done: p.done,
      extra: ` · ${lira(p.done ? p.expected_amount : left)}${!p.done && date < today ? " gecikti" : ""}`,
      tick: p.done ? null : { type: "payment", id: p.id, amount: left },
    };
  };
  const fromFollowUp = (f: DueFollowUp): CalItem => ({
    key: `f${f.type}${f.id}`, time: null, title: `${f.name} takibi`, kind: "follow", done: f.done, extra: "", tick: null,
    href: recordPath(f.type, f.id) ?? undefined,
  });
  const all = [...tasks.map(fromTask), ...payments.map(fromPayment), ...followUps.map(fromFollowUp)];
  return all.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
}

const dayItems = (d: CalendarDay, today: string) => itemsOf(d.date, d.tasks, d.payments, d.follow_ups, today);

/** Items of every day of the feed, by date */
export const itemsByDate = (days: CalendarDay[], today: string) => new Map(days.map((d) => [d.date, dayItems(d, today)]));

const shortDate = (iso: string) => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(toDate(iso));

/** Monday on or before the date */
export const mondayOf = (iso: string) => addDaysIso(iso, -((toDate(iso).getDay() + 6) % DAYS_IN_WEEK));

/** ISO week number of a date: the week of its Thursday */
export function isoWeek(iso: string): number {
  const thursday = toDate(addDaysIso(mondayOf(iso), 3));
  const jan1 = new Date(thursday.getFullYear(), 0, 1, 12);
  return Math.floor((thursday.getTime() - jan1.getTime()) / (DAYS_IN_WEEK * 86_400_000)) + 1;
}

export type View = "week" | "month";

/** The visible day range: the week, or whole weeks covering the month */
export function rangeOf(view: View, anchor: string): { from: string; to: string } {
  if (view === "week") {
    const from = mondayOf(anchor);
    return { from, to: addDaysIso(from, DAYS_IN_WEEK - 1) };
  }
  const first = `${anchor.slice(0, 7)}-01`;
  const last = addDaysIso(`${addDaysIso(first, 31).slice(0, 7)}-01`, -1);
  return { from: mondayOf(first), to: addDaysIso(mondayOf(last), DAYS_IN_WEEK - 1) };
}

const dayMonthWeekday = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long" });
/** "13 Ekim Salı", with "Bugün · " in front for today */
export const dayTitle = (iso: string, today: string) => `${iso === today ? "Bugün · " : ""}${dayMonthWeekday.format(toDate(iso))}`;
