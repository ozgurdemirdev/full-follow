// Timeline (Zaman çizelgesi): labels and icons of the screen, the day groups and the week strip numbers.
// The rows themselves come from the timeline module (`GET /api/timeline`, see useTimelineFeed.ts); nothing is composed in the browser.
import type { ModuleKey } from "@kit/api/modules";
import type { TlDayCount, TlPage, TlRow, TlType, TlWeek, TlWeekData } from "./types";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { lira, toDate } from "@kit/lib/format";
import { LOCALE } from "@kit/lib/i18n";
import type { Actor } from "@kit/lib/labels";
import { m } from "./messages";
import { m as kit } from "@kit/messages";

/** Events requested for a focused record: enough to hold its whole stage history (its oldest one dates "ilk kayıt") */
export const STAGE_EVENTS_LIMIT = 500;
/** Rows of a feed page: shown first, and added by every "Daha eski olaylar" */
export const TL_PAGE = 60;
/** How long the search box rests before it asks the server */
export const TL_SEARCH_DEBOUNCE_MS = 300;
/** How far below the viewport the next page is asked for: one viewport height (IntersectionObserver rootMargin: top, right, bottom, left) */
export const TL_PREFETCH_MARGIN = "0% 0% 100% 0%";
const DAY_MS = 86_400_000;

// ------------------------------------------------------------ types and records
const PAY_ICON = "M3 7h18v10H3zM3 10h18M7 14h3";
const COMMENT_LINES_ICON = "M8 10h8M8 14h5M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z";
const PERSON_ICON = "M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5";

/** Type pills and row icons, in the board's order */
export const TL_TYPES: { key: TlType; label: string; icon: string }[] = [
  { key: "temas", label: m.types.touch, icon: BOARD_ICON.comment },
  { key: "odeme", label: m.types.payment, icon: PAY_ICON },
  { key: "gorev", label: m.types.task, icon: BOARD_ICON.check },
  { key: "asama", label: m.types.stage, icon: BOARD_ICON.arrowRight },
  { key: "taslak", label: m.types.draft, icon: BOARD_ICON.pen },
  { key: "yorum", label: m.types.comment, icon: COMMENT_LINES_ICON },
];
export const TL_TYPE = Object.fromEntries(TL_TYPES.map((t) => [t.key, t])) as Record<TlType, (typeof TL_TYPES)[number]>;

export const ACTOR_PILLS: { value: "all" | Actor; label: string }[] = [
  { value: "all", label: kit.all },
  { value: "owner", label: m.actor.owner },
  { value: "claude", label: m.actor.claude },
];

export interface RecKind {
  label: string;
  icon: string;
  /** the module that owns the record: its chip focuses it only when that module is installed */
  module?: ModuleKey;
  /** the chip focuses the record (and the address /zaman/:kind/:id opens it) */
  focus: boolean;
}
export const REC_KIND: Record<string, RecKind> = {
  project: { label: m.records.project, icon: BOARD_ICON.folder, focus: true, module: "projects" },
  person: { label: m.records.person, icon: PERSON_ICON, focus: true, module: "people" },
  company: { label: m.records.company, icon: BOARD_ICON.building, focus: true, module: "companies" },
  opportunity: { label: m.records.opportunity, icon: BOARD_ICON.funnel, focus: true, module: "pipeline" },
  own_project: { label: m.records.ownProject, icon: BOARD_ICON.cube, focus: true, module: "own-projects" },
  idea: { label: m.records.idea, icon: BOARD_ICON.bulb, focus: false },
  post: { label: m.records.post, icon: BOARD_ICON.megaphone, focus: false },
  template: { label: m.records.template, icon: BOARD_ICON.template, focus: false },
};
const OTHER_KIND: RecKind = { label: m.records.other, icon: BOARD_ICON.note, focus: false };
export const recKind = (kind: string) => REC_KIND[kind] ?? OTHER_KIND;
/** Whether a chip of this kind can focus its record: the kind has a history view and its module is installed */
export const canFocus = (kind: string, has: (key: ModuleKey) => boolean) => {
  const k = recKind(kind);
  return k.focus && !!k.module && has(k.module);
};
/** Colour key of a record kind (data-rec): the five focusable kinds have their own, the rest share one */
export const recTone = (kind: string) => (REC_KIND[kind]?.focus ? kind : "other");
/** Records that have a detail page and an event list behind the API: the focus view adds their side cards */
export const ASIDE_KINDS = ["person", "opportunity", "project"] as const;
export type AsideKind = (typeof ASIDE_KINDS)[number];
export const isAsideKind = (k: string | undefined): k is AsideKind => ASIDE_KINDS.includes(k as AsideKind);

// ------------------------------------------------------------ time
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long" });
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" });
const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: "long" });
const clock = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const pad = (n: number) => String(n).padStart(2, "0");
export const fmtClock = (iso: string) => clock.format(Date.parse(iso));
/** Local day of an instant, "2026-10-13" */
const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** "Bugün · 13 Ekim", "Dün · 12 Ekim", "Cumartesi · 11 Ekim" (the year only when it is not this one) */
function dayTitle(key: string, now: number) {
  const day = toDate(key);
  if (key === dayKey(now)) return m.day.today(dayMonth.format(day));
  if (key === dayKey(now - DAY_MS)) return m.day.yesterday(dayMonth.format(day));
  const name = weekday.format(day);
  const cap = name.charAt(0).toLocaleUpperCase(LOCALE) + name.slice(1);
  return m.day.titled(cap, (day.getFullYear() === new Date(now).getFullYear() ? dayMonth : dayMonthYear).format(day));
}

// ------------------------------------------------------------ day groups
export interface TlDay {
  key: string;
  title: string;
  /** "3 sen · 2 Claude": every row of the day, whatever the filters */
  sum: string;
  events: TlRow[];
}

/** Rows (newest first, already in the order the server gave) under their day headers */
export function groupDays(rows: TlRow[], counts: Record<string, TlDayCount>, now = Date.now()): TlDay[] {
  const days: TlDay[] = [];
  for (const r of rows) {
    let d = days[days.length - 1];
    if (!d || d.key !== r.day) {
      const c = counts[r.day] ?? { owner: 0, claude: 0 };
      d = { key: r.day, title: dayTitle(r.day, now), sum: m.day.sum(c.owner, c.claude), events: [] };
      days.push(d);
    }
    d.events.push(r);
  }
  return days;
}

/** Focus card line: how many rows, since when, and the latest one */
export function focusSummary(latest: TlPage | undefined, firstAt: string | undefined, now = Date.now()): string {
  const parts = [m.focus.events(latest?.total ?? 0)];
  if (firstAt) {
    const first = toDate(firstAt);
    parts.push(m.focus.firstRecord(dayMonth.format(first)), m.focus.daysTracked(Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(first.getTime()).getTime()) / DAY_MS))));
  }
  if (latest?.rows[0]) parts.push(m.focus.latest(latest.rows[0].text));
  return parts.join(" · ");
}

// ------------------------------------------------------------ week strip
/** The week strip of the board from the server's counts */
export function weekView(w: TlWeekData): TlWeek {
  return {
    me: w.me, cl: w.claude,
    tiles: [
      { type: "temas", label: m.week.touches, value: String(w.touches), sub: m.week.lastWeek(w.prev.touches) },
      { type: "odeme", label: m.week.collected, value: w.collections_amount === null ? m.week.unknown : lira(w.collections_amount), sub: m.week.payments(w.collections_count) },
      { type: "gorev", label: m.week.tasksDone, value: String(w.tasks_done), sub: m.week.lastWeek(w.prev.tasks_done) },
      { type: "taslak", label: m.week.claudeDrafts, value: String(w.claude_drafts), sub: m.week.approved(w.claude_drafts_approved) },
    ],
  };
}
