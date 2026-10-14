// People screen: statuses, warmth thresholds, channels, the texts of the "Bugün dokun" cards and the per day memory
import { useSyncExternalStore } from "react";
import { run } from "../api/actions";
import type { Person, Task } from "../api/types";
import type { BoardIconName } from "../components/boardIcons";
import { daysFrom, fmtDay, followNote, todayIso, toDate } from "./format";

/** "Bugün dokun" shows at most this many cards */
export const TOUCH_CARDS = 4;
/** Last touch up to this many days ago reads "Sıcak" */
export const WARM_DAYS = 7;
/** Last touch up to this many days ago reads "Ilık", older reads "Soğuyor" */
export const LUKEWARM_DAYS = 21;
/** A person added within this many days reads "Yeni" */
export const FRESH_DAYS = 14;
/** The list shows the date and time of a task as "Per 11:00" up to this many days ahead, then as a date */
const WEEKDAY_DAYS = 7;

export type PStatus = "due" | "wait" | "cold" | "fresh" | "ok";
export const STATUS_LABEL: Record<PStatus, string> = { due: "Takibi geldi", wait: "Cevap bekleniyor", cold: "Soğuyor", fresh: "Yeni", ok: "" };
/** Pill order of the list filter ("Hepsi" first) */
export const FILTERS: { key: "all" | Exclude<PStatus, "ok">; label: string }[] = [
  { key: "all", label: "Hepsi" },
  { key: "due", label: "Takibi gelen" },
  { key: "wait", label: "Cevap bekleyen" },
  { key: "cold", label: "Soğuyan" },
  { key: "fresh", label: "Yeni" },
];
/** Rank of a status in the list (lower first); "Bugün dokun" takes the first three */
export const STATUS_RANK: Record<PStatus, number> = { due: 0, wait: 1, cold: 2, fresh: 3, ok: 4 };

export type Warmth = "hot" | "mid" | "cold";
export const WARMTH_NAME: Record<Warmth, string> = { hot: "Sıcak", mid: "Ilık", cold: "Soğuyor" };
export const warmth = (days: number): Warmth => (days <= WARM_DAYS ? "hot" : days <= LUKEWARM_DAYS ? "mid" : "cold");

/** One status per person: a follow-up that came due beats a waiting reply, that beats cooling, that beats new */
export function statusOf(p: Person, today = todayIso()): PStatus {
  if (p.next_follow_up_at && p.next_follow_up_at <= today) return "due";
  if (p.awaiting) return "wait";
  if (p.cooling) return "cold";
  if (daysFrom(p.created_at.slice(0, 10), today) >= -FRESH_DAYS) return "fresh";
  return "ok";
}

export const agoText = (days: number) => (days === 0 ? "bugün" : days === 1 ? "dün" : `${days} gün önce`);

// ------------------------------------------------------------ channels
export interface ChannelDef {
  /** core channel name (touches.channel) */
  key: string;
  label: string;
  icon: BoardIconName;
  /** how the person's account in this channel reads */
  handle: (p: Person) => string | null;
}
/** The four channels of the board, in its order; a person has a channel when the account is filled in */
export const CHANNELS: ChannelDef[] = [
  { key: "linkedin", label: "LinkedIn", icon: "linkedin", handle: (p) => p.linkedin },
  { key: "email", label: "E-posta", icon: "mail", handle: (p) => p.email },
  { key: "telefon", label: "Telefon", icon: "phone", handle: (p) => p.phone },
  { key: "instagram", label: "Instagram", icon: "instagram", handle: (p) => p.instagram },
];
export const channelsOf = (p: Person) => CHANNELS.filter((c) => !!c.handle(p));
/** Channel of a new touch: the last one used, else the first account the person has */
export const defaultChannel = (p: Person) => p.last_channel ?? channelsOf(p)[0]?.key ?? "diger";

// ------------------------------------------------------------ rhythm
/** Bar level of a week: none, one touch, two or more */
export const rhythmLevel = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : 2);

// ------------------------------------------------------------ cards and rows
const DRAFT_KIND: Partial<Record<PStatus, string>> = { due: "Takip taslağı", wait: "Takip taslağı", cold: "Selam taslağı" };

/** Label after "Claude yazsın:" */
export const draftKind = (p: Person, s: PStatus) => (s === "due" && p.last_direction === "gelen" ? "Cevap taslağı" : DRAFT_KIND[s] ?? "Taslak");

/** One sentence on why the card is there */
export function whyText(p: Person, s: PStatus): string {
  if (s === "due") {
    const f = followNote(p.next_follow_up_at);
    return `${f?.late ? `Takip ${f.text}` : "Takip günü bugün"}. Son temas ${agoText(p.days_since)}.`;
  }
  if (s === "wait" && p.awaiting) {
    const a = p.awaiting;
    return `${a.days === 0 ? "Bugün" : `${a.days} gün önce`} yazdın${a.attempts > 1 ? `, ${a.attempts}. mesaj` : ""}, henüz ses yok.`;
  }
  return `${p.days_since} gündür sessiz.`;
}

/** Ask Claude for a message draft (a task for Claude; the draft lands in Taslaklar) */
export const askDraft = (p: Pick<Person, "id" | "name">) =>
  run("post", "/tasks", { title: `${p.name} için mesaj taslağı hazırla`, assignee: "claude", due_date: todayIso(), person_id: p.id }, { ok: "Claude taslağı yazıyor, Taslaklar’a düşecek" });

const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "short" });
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
  const at = d < 0 ? "Gecikti" : d === 0 ? `Bugün${time}` : d === 1 ? `Yarın${time}` : d < WEEKDAY_DAYS ? `${cap(weekday.format(toDate(date)))}${time}` : `${fmtDay(date)}${time}`;
  return { text: own?.title ?? "Takip", at, tone: d < 0 ? "late" : d === 0 ? "today" : "later" };
}
const cap = (s: string) => s.charAt(0).toLocaleUpperCase("tr-TR") + s.slice(1);

// ------------------------------------------------------------ per day memory (this browser only)
type Kind = "gone" | "drafted" | "companyDrafted";
const cache = new Map<string, ReadonlySet<number>>();
const listeners = new Set<() => void>();
const storageKey = (kind: Kind, day: string) => `ff.people.${kind}.${day}`;

function read(kind: Kind): ReadonlySet<number> {
  const day = todayIso();
  const key = storageKey(kind, day);
  let set = cache.get(key);
  if (!set) {
    try {
      set = new Set<number>(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      set = new Set<number>();
    }
    cache.set(key, set);
  }
  return set;
}

/** People marked for today in this browser: "gone" (Yaptım) and "drafted" (draft asked); yesterday's marks are not read */
export function useDayMarks(kind: Kind) {
  const set = useSyncExternalStore((fn) => (listeners.add(fn), () => void listeners.delete(fn)), () => read(kind));
  const mark = (id: number) => {
    const next = new Set(read(kind)).add(id);
    cache.set(storageKey(kind, todayIso()), next);
    try {
      localStorage.setItem(storageKey(kind, todayIso()), JSON.stringify([...next]));
    } catch {
      /* private window: the mark lives until reload */
    }
    listeners.forEach((fn) => fn());
  };
  return [set, mark] as const;
}

/** Order of the touch cards: by status, then the most overdue first inside a status */
export function compareTouch(a: Person, b: Person, today = todayIso()): number {
  const sa = statusOf(a, today);
  const sb = statusOf(b, today);
  if (sa !== sb) return STATUS_RANK[sa] - STATUS_RANK[sb];
  if (sa === "due") return (a.next_follow_up_at ?? "").localeCompare(b.next_follow_up_at ?? "");
  if (sa === "wait") return (b.awaiting?.days ?? 0) - (a.awaiting?.days ?? 0);
  return b.days_since - a.days_since;
}

/** The stream of a person shows this many entries until "daha" is pressed */
export const STREAM_SHOWN = 30;
