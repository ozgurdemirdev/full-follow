import { LANG } from "./i18n";
import { m } from "./messages";

const pad = (n: number) => String(n).padStart(2, "0");

/** Yerel saate göre YYYY-MM-DD */
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return localDate(new Date(y, m - 1, d + days));
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

/** A day that exists on the calendar: the shape alone lets "2026-13-45" and "2026-02-31" through, so the parts must survive a round trip (UTC, no timezone shift) */
export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, mo, d] = s.split("-").map(Number);
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d);
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}
export const isIsoMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const isIsoDateTime = (s: string) => {
  if (ISO_DATE.test(s)) return isIsoDate(s);
  const time = ISO_DATETIME.exec(s);
  return time !== null && isIsoDate(s.slice(0, 10)) && Number(time[1]) < 24 && Number(time[2]) < 60 && Number(time[3] ?? 0) < 60;
};

/**
 * Kısa tarih biçimlerini ISO'ya çevirir: "bugün", "yarın", "dün", "+3g", "-2g", "+1h" (hafta).
 * Tanınmayan değeri olduğu gibi döner (doğrulama sonra yapılır).
 */
export function resolveRelativeDate(input: unknown, today = localDate()): unknown {
  if (typeof input !== "string") return input;
  const s = input.trim().toLocaleLowerCase(LANG);
  if (s === m.date.today || s === m.date.todayAscii || s === "today") return today;
  if (s === m.date.tomorrow || s === m.date.tomorrowAscii || s === "tomorrow") return addDays(today, 1);
  if (s === m.date.yesterday || s === m.date.yesterdayAscii || s === "yesterday") return addDays(today, -1);
  const offset = /^([+-]\d+)\s*([gh]?)$/.exec(s);
  if (offset) return addDays(today, Number(offset[1]) * (offset[2] === "h" ? 7 : 1));
  return input.trim();
}

/** "2026-10" ya da tarih → "2026-10" */
export const monthOf = (iso: string) => iso.slice(0, 7);

/** ISO tarih ya da zaman → yerel gün (YYYY-MM-DD) */
export function dayOf(iso: string): string {
  return iso.length <= 10 ? iso : localDate(new Date(iso));
}

/** SQL for the local day (YYYY-MM-DD) of a timestamp column, the SQL form of `dayOf`: every daily bucket of a timestamp uses it, because "today" is the local date */
export const localDay = (column: string) => `date(${column}, 'localtime')`;

/** ISO weekday: 1 = Monday ... 7 = Sunday */
export const isoWeekday = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** İki gün arası fark (b − a), gün olarak */
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/** Haftanın pazartesisi */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const day = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return addDays(iso, -day);
}

/** ISO week label of a date: "2026-W41" (the ISO year is the year of the week's Thursday) */
export function isoWeekOf(iso: string): string {
  const monday = weekStart(iso);
  const year = Number(addDays(monday, 3).slice(0, 4));
  const week = daysBetween(weekStart(`${year}-01-04`), monday) / 7 + 1;
  return `${year}-W${pad(week)}`;
}

/** Monday of an ISO week label ("2026-W41"); null when the label is not a real ISO week */
export function isoWeekStart(week: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return null;
  const monday = addDays(weekStart(`${m[1]}-01-04`), (Number(m[2]) - 1) * 7);
  return isoWeekOf(monday) === week ? monday : null;
}
