// What the people, companies, network and marketing screens share about a person: statuses, warmth thresholds, channels, the per day memory
import { useSyncExternalStore } from "react";
import { run } from "../api/actions";
import type { Person } from "../api/types";
import type { BoardIconName } from "../components/boardIcons";
import { people as m } from "../messages.lib";
import { daysFrom, todayIso } from "./format";

/** Last touch up to this many days ago reads "Sıcak" */
export const WARM_DAYS = 7;
/** Last touch up to this many days ago reads "Ilık", older reads "Soğuyor" */
export const LUKEWARM_DAYS = 21;
/** A person added within this many days reads "Yeni" */
export const FRESH_DAYS = 14;

export type PStatus = "due" | "wait" | "cold" | "fresh" | "ok";
/** Rank of a status in the list (lower first); "Bugün dokun" takes the first three */
export const STATUS_RANK: Record<PStatus, number> = { due: 0, wait: 1, cold: 2, fresh: 3, ok: 4 };

/** One status per person: a follow-up that came due beats a waiting reply, that beats cooling, that beats new */
export function statusOf(p: Person, today = todayIso()): PStatus {
  if (p.next_follow_up_at && p.next_follow_up_at <= today) return "due";
  if (p.awaiting) return "wait";
  if (p.cooling) return "cold";
  if (daysFrom(p.created_at.slice(0, 10), today) >= -FRESH_DAYS) return "fresh";
  return "ok";
}

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
  { key: "linkedin", label: m.channels.linkedin, icon: "linkedin", handle: (p) => p.linkedin },
  { key: "email", label: m.channels.email, icon: "mail", handle: (p) => p.email },
  { key: "telefon", label: m.channels.telefon, icon: "phone", handle: (p) => p.phone },
  { key: "instagram", label: m.channels.instagram, icon: "instagram", handle: (p) => p.instagram },
];
export const channelsOf = (p: Person) => CHANNELS.filter((c) => !!c.handle(p));
/** Channel of a new touch: the last one used, else the first account the person has */
export const defaultChannel = (p: Person) => p.last_channel ?? channelsOf(p)[0]?.key ?? "diger";

// ------------------------------------------------------------ cards and rows
const DRAFT_KIND: Partial<Record<PStatus, string>> = { due: m.followDraft, wait: m.followDraft, cold: m.greetDraft };

/** Label after "Claude yazsın:" */
export const draftKind = (p: Person, s: PStatus) => (s === "due" && p.last_direction === "gelen" ? m.replyDraft : DRAFT_KIND[s] ?? m.otherDraft);

/** Ask Claude for a message draft (a task for Claude; the draft lands in Taslaklar) */
export const askDraft = (p: Pick<Person, "id" | "name">) =>
  run("post", "/tasks", { title: m.draftTask(p.name), assignee: "claude", due_date: todayIso(), person_id: p.id }, { ok: m.draftAsked });

// ------------------------------------------------------------ per day memory (this browser only)
type Kind = "gone" | "drafted" | "companyDrafted" | "pitched";
const cache = new Map<string, ReadonlySet<number>>();
const listeners = new Set<() => void>();
const KEY_PREFIX = "ff.people.";
const storageKey = (kind: Kind, day: string) => `${KEY_PREFIX}${kind}.${day}`;

let prunedFor = "";

/** Marks only count for their own day: once per day, the keys and cache entries of other days are dropped so storage does not gain a key per day for ever */
function pruneOtherDays(day: string) {
  prunedFor = day;
  for (const k of cache.keys()) if (!k.endsWith(`.${day}`)) cache.delete(k);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX) && !k.endsWith(`.${day}`)) localStorage.removeItem(k);
    }
  } catch {
    /* private window */
  }
}

function read(kind: Kind): ReadonlySet<number> {
  const day = todayIso();
  if (prunedFor !== day) pruneOtherDays(day);
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

// ------------------------------------------------------------ last touch (people, company tiles and the org cards)
/** Last touch older than this many days reads in the cold colour */
export const COLD_DAYS = LUKEWARM_DAYS;

/** Days since an ISO time (0 for today and for the future) */
export const daysSince = (iso: string) => Math.max(0, -daysFrom(iso, todayIso()));

export const lastText = (days: number | null) => (days === null ? m.noTouch : days <= 1 ? (days === 0 ? m.lastToday : m.lastYesterday) : m.lastDaysAgo(days));

/** Warmth word of the board for the colour of an org card dot: none, hot, mid, cold */
export const warmthOf = (days: number | null): "none" | "hot" | "mid" | "cold" =>
  days === null ? "none" : days <= WARM_DAYS ? "hot" : days <= COLD_DAYS ? "mid" : "cold";
