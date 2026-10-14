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
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

export const isIsoDate = (s: string) => ISO_DATE.test(s);
export const isIsoDateTime = (s: string) => ISO_DATE.test(s) || ISO_DATETIME.test(s);

/**
 * Kısa tarih biçimlerini ISO'ya çevirir: "bugün", "yarın", "dün", "+3g", "-2g", "+1h" (hafta).
 * Tanınmayan değeri olduğu gibi döner (doğrulama sonra yapılır).
 */
export function resolveRelativeDate(input: unknown, today = localDate()): unknown {
  if (typeof input !== "string") return input;
  const s = input.trim().toLocaleLowerCase("tr");
  if (s === "bugün" || s === "bugun" || s === "today") return today;
  if (s === "yarın" || s === "yarin" || s === "tomorrow") return addDays(today, 1);
  if (s === "dün" || s === "dun" || s === "yesterday") return addDays(today, -1);
  const m = /^([+-]\d+)\s*([gh]?)$/.exec(s);
  if (m) return addDays(today, Number(m[1]) * (m[2] === "h" ? 7 : 1));
  return input.trim();
}

/** "2026-10" ya da tarih → "2026-10" */
export const monthOf = (iso: string) => iso.slice(0, 7);

/** ISO tarih ya da zaman → yerel gün (YYYY-MM-DD) */
export function dayOf(iso: string): string {
  return iso.length <= 10 ? iso : localDate(new Date(iso));
}

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
