// Timeline (Zaman çizelgesi): labels and icons of the screen, the day groups and the week strip numbers.
// The rows themselves come from the timeline module (`GET /api/timeline`, see useTimelineFeed.ts); nothing is composed in the browser.
import type { ModuleKey } from "@kit/api/modules";
import type { TlDayCount, TlPage, TlRow, TlType, TlWeek, TlWeekData } from "./types";
import { BOARD_ICON } from "@kit/components/boardIcons";
import { lira, toDate } from "@kit/lib/format";
import type { Actor } from "@kit/lib/labels";

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
  { key: "temas", label: "Temas", icon: BOARD_ICON.comment },
  { key: "odeme", label: "Ödeme", icon: PAY_ICON },
  { key: "gorev", label: "Görev", icon: BOARD_ICON.check },
  { key: "asama", label: "Aşama", icon: BOARD_ICON.arrowRight },
  { key: "taslak", label: "Taslak", icon: BOARD_ICON.pen },
  { key: "yorum", label: "Yorum", icon: COMMENT_LINES_ICON },
];
export const TL_TYPE = Object.fromEntries(TL_TYPES.map((t) => [t.key, t])) as Record<TlType, (typeof TL_TYPES)[number]>;

export const ACTOR_PILLS: { value: "all" | Actor; label: string }[] = [
  { value: "all", label: "Hepsi" },
  { value: "ozgur", label: "Sen" },
  { value: "claude", label: "Claude" },
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
  project: { label: "Proje", icon: BOARD_ICON.folder, focus: true, module: "projects" },
  person: { label: "Kişi", icon: PERSON_ICON, focus: true, module: "people" },
  company: { label: "Firma", icon: BOARD_ICON.building, focus: true, module: "companies" },
  opportunity: { label: "Fırsat", icon: BOARD_ICON.funnel, focus: true, module: "pipeline" },
  own_project: { label: "Kendi projem", icon: BOARD_ICON.cube, focus: true, module: "own-projects" },
  idea: { label: "Fikir", icon: BOARD_ICON.bulb, focus: false },
  post: { label: "Paylaşım", icon: BOARD_ICON.megaphone, focus: false },
  template: { label: "Şablon", icon: BOARD_ICON.template, focus: false },
};
const OTHER_KIND: RecKind = { label: "Kayıt", icon: BOARD_ICON.note, focus: false };
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
const dayMonth = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" });
const dayMonthYear = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "long" });
const clock = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
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
  if (key === dayKey(now)) return `Bugün · ${dayMonth.format(day)}`;
  if (key === dayKey(now - DAY_MS)) return `Dün · ${dayMonth.format(day)}`;
  const name = weekday.format(day);
  const cap = name.charAt(0).toLocaleUpperCase("tr-TR") + name.slice(1);
  return `${cap} · ${(day.getFullYear() === new Date(now).getFullYear() ? dayMonth : dayMonthYear).format(day)}`;
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
      const c = counts[r.day] ?? { ozgur: 0, claude: 0 };
      d = { key: r.day, title: dayTitle(r.day, now), sum: `${c.ozgur} sen · ${c.claude} Claude`, events: [] };
      days.push(d);
    }
    d.events.push(r);
  }
  return days;
}

/** Focus card line: how many rows, since when, and the latest one */
export function focusSummary(latest: TlPage | undefined, firstAt: string | undefined, now = Date.now()): string {
  const parts = [`${latest?.total ?? 0} olay`];
  if (firstAt) {
    const first = toDate(firstAt);
    parts.push(`ilk kayıt ${dayMonth.format(first)}`, `${Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(first.getTime()).getTime()) / DAY_MS))} gündür takipte`);
  }
  if (latest?.rows[0]) parts.push(`son: ${latest.rows[0].text}`);
  return parts.join(" · ");
}

// ------------------------------------------------------------ week strip
const LAST_WEEK = "geçen hafta";

/** The week strip of the board from the server's counts */
export function weekView(w: TlWeekData): TlWeek {
  return {
    me: w.me, cl: w.claude,
    tiles: [
      { type: "temas", label: "Temas", value: String(w.touches), sub: `${LAST_WEEK} ${w.prev.touches}` },
      { type: "odeme", label: "Tahsilat", value: lira(w.collections_amount), sub: `${w.collections_count} ödeme` },
      { type: "gorev", label: "Biten görev", value: String(w.tasks_done), sub: `${LAST_WEEK} ${w.prev.tasks_done}` },
      { type: "taslak", label: "Claude taslağı", value: String(w.claude_drafts), sub: `${w.claude_drafts_approved} onaylandı` },
    ],
  };
}
