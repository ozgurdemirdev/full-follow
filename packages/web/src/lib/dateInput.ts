// Typed date and time for the form sheet's date fields: "17 Ekim", "yarın", "cuma", "14:20" in, ISO out
import { m as kit } from "../messages";
import { dates as m } from "../messages.lib";
import { addDaysIso, fmtToday, norm, todayIso, toDate } from "./format";
import { LOCALE } from "./i18n";

const MONTHS = ["ocak", "subat", "mart", "nisan", "mayis", "haziran", "temmuz", "agustos", "eylul", "ekim", "kasim", "aralik"];
const WEEKDAYS = ["pazar", "pazartesi", "sali", "carsamba", "persembe", "cuma", "cumartesi"];
const FRIDAY = 5;
const MONDAY = 1;
const WEEK = 7;
const TIME = /(\d{1,2})[:.](\d{2})\b/;
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The next given weekday after today (today itself when `inclusive`) */
function nextWeekday(day: number, from: string, inclusive: boolean): string {
  const diff = (day - toDate(from).getDay() + WEEK) % WEEK;
  return addDaysIso(from, diff === 0 && !inclusive ? WEEK : diff);
}

/** The quick chips of a date field: label and the date each one means */
export function quickDates(today = todayIso()): { label: string; iso: string }[] {
  return [
    { label: kit.today, iso: today },
    { label: kit.tomorrow, iso: addDaysIso(today, 1) },
    { label: m.friday, iso: nextWeekday(FRIDAY, today, false) },
    { label: m.nextWeek, iso: nextWeekday(MONDAY, today, false) },
  ];
}

/** ISO date from text, or null when it is not understood */
export function parseDate(text: string, today = todayIso()): string | null {
  const t = norm(text).replace(/[,]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const quick = quickDates(today);
  if (t === "bugun") return quick[0].iso;
  if (t === "yarin") return quick[1].iso;
  if (t === "gelecek hafta") return quick[3].iso;
  const wd = WEEKDAYS.indexOf(t);
  if (wd >= 0) return nextWeekday(wd, today, true);
  const year = Number(today.slice(0, 4));
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return t;
  m = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?$/.exec(t);
  if (m) return valid(Number(m[3] ?? year), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2}) ([a-z]+)(?: (\d{4}))?(?: [a-z]+)?$/.exec(t);
  if (m) {
    const month = MONTHS.findIndex((x) => x.startsWith(m![2]) && m![2].length >= 3);
    if (month >= 0) return valid(Number(m[3] ?? year), month + 1, Number(m[1]));
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  const dt = new Date(y, mo - 1, d, 12);
  return dt.getMonth() === mo - 1 && dt.getDate() === d ? iso(y, mo, d) : null;
}

const withYear = new Intl.DateTimeFormat(LOCALE,{ day: "numeric", month: "long", year: "numeric", weekday: "long" });

/** Display text of an ISO date: "15 Ekim Çarşamba" (with the year when it is not this year) */
export function formatDate(value: string): string {
  if (!value) return "";
  return value.slice(0, 4) === todayIso().slice(0, 4) ? fmtToday(value) : withYear.format(toDate(value));
}

/** "HH:MM" from "11:30", "11.30", "1130" or "9"; null when it is not a time */
export function parseTime(text: string): string | null {
  const t = text.trim();
  const m = TIME.exec(t) ?? /^(\d{1,2})(\d{2})$/.exec(t);
  const [h, min] = m ? [Number(m[1]), Number(m[2])] : /^\d{1,2}$/.test(t) ? [Number(t), 0] : [NaN, NaN];
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
}

/** Date and time in one value ("2026-10-15T14:20", local time): display and parse */
export function formatDateTime(value: string): string {
  if (!value) return "";
  const [d, time] = value.split("T");
  const day = d === todayIso() ? kit.today : formatDate(d);
  return time ? `${day}, ${time}` : day;
}
export function parseDateTime(text: string, fallbackTime: string): string | null {
  const m = TIME.exec(text);
  const time = m ? parseTime(m[0]) : null;
  const day = parseDate(m ? text.replace(m[0], "") : text);
  return day ? `${day}T${time ?? fallbackTime}` : null;
}
