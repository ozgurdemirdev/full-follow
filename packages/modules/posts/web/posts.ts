// Posts screen: sorting, platform totals, the "per post" figure and the age texts, all derived from the one posts list
import type { Person, Post } from "@kit/api/types";
import { daysFrom } from "@kit/lib/format";
import { PLATFORM } from "@kit/lib/labels";

const PERCENT = 100;
const MIN_BAR_PERCENT = 4;
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;
const SINGLE_DECIMAL = 10;
/** People shown as avatars on a tile; the rest is written as "+N kişi daha" */
export const TILE_AVATARS = 4;
/** Platforms that always get a column in the platform strip; "diger" joins only when it has posts */
const MAIN_PLATFORMS = ["r10", "linkedin", "instagram"];

/** Full class names so Tailwind finds them: bar colour per platform */
export const PLATFORM_BAR: Record<string, string> = {
  r10: "bg-posts-r10-fg",
  linkedin: "bg-posts-linkedin-fg",
  instagram: "bg-posts-instagram-fg",
  diger: "bg-posts-diger-fg",
};

/** Most value first, then most people (the board's order) */
export const byValue = (a: Post, b: Post) => b.won_value - a.won_value || b.people_count - a.people_count;

/** Whole days since the post went up or was last refreshed */
const daysSince = (iso: string) => Math.max(0, -daysFrom(iso));

/** Days since the last refresh (the post day when it was never refreshed) */
export const staleDays = (p: Post) => daysSince(p.refreshed_at ?? p.posted_at);

/** "bugün", "8 gün önce", "3 hafta önce", "1 ay önce" */
export function ageText(p: Post): string {
  const refreshed = p.refreshed_at ? daysSince(p.refreshed_at) : null;
  if (refreshed === 0) return "bugün güncellendi";
  const d = daysSince(p.posted_at);
  if (d === 0) return "bugün";
  if (d < DAYS_PER_WEEK * 2) return `${d} gün önce`;
  if (d < DAYS_PER_MONTH) return `${Math.floor(d / DAYS_PER_WEEK)} hafta önce`;
  if (d < DAYS_PER_YEAR) return `${Math.floor(d / DAYS_PER_MONTH)} ay önce`;
  return `${Math.floor(d / DAYS_PER_YEAR)} yıl önce`;
}

export interface PlatformStat {
  key: string;
  name: string;
  count: number;
  people: number;
  won: number;
  /** bar width in percent, relative to the platform with the most won value */
  width: number;
}

/** One entry per platform of the strip (R10, LinkedIn, Instagram, and Diğer when used) */
export function platformStats(rows: Post[]): PlatformStat[] {
  const keys = MAIN_PLATFORMS.concat(rows.some((p) => p.platform === "diger") ? ["diger"] : []);
  const stats = keys.map((key) => {
    const list = rows.filter((p) => p.platform === key);
    return { key, name: PLATFORM[key], count: list.length, people: list.reduce((a, p) => a + p.people_count, 0), won: list.reduce((a, p) => a + p.won_value, 0), width: 0 };
  });
  const max = Math.max(1, ...stats.map((s) => s.won));
  return stats.map((s) => ({ ...s, width: Math.max(MIN_BAR_PERCENT, Math.round((s.won / max) * PERCENT)) }));
}

export interface PerPost {
  /** people per post, one decimal, Turkish comma: "1,9" */
  average: string;
  /** most efficient platform ("R10 ilanları") or null while nobody came yet */
  best: string | null;
  width: number;
}

/** The "Paylaşım başına" column: people per post overall, the best platform, and the bar against that platform */
export function perPost(rows: Post[], stats: PlatformStat[]): PerPost {
  const avg = rows.length ? rows.reduce((a, p) => a + p.people_count, 0) / rows.length : 0;
  const rates = stats.filter((s) => s.count).map((s) => ({ key: s.key, name: s.name, rate: s.people / s.count }));
  const top = rates.reduce<(typeof rates)[number] | null>((m, r) => (!m || r.rate > m.rate ? r : m), null);
  const noun = top?.key === "r10" ? "ilanları" : "paylaşımları";
  return {
    average: (Math.round(avg * SINGLE_DECIMAL) / SINGLE_DECIMAL).toLocaleString("tr-TR"),
    best: top && top.rate > 0 ? `${top.name} ${noun}` : null,
    width: top && top.rate > 0 ? Math.max(MIN_BAR_PERCENT, Math.round((avg / top.rate) * PERCENT)) : MIN_BAR_PERCENT,
  };
}

/** People of each post, from the one people list (people.post_id) */
export function peopleByPost(people: Person[]): Map<number, Person[]> {
  const map = new Map<number, Person[]>();
  for (const p of people) {
    if (!p.post_id) continue;
    const list = map.get(p.post_id);
    if (list) list.push(p);
    else map.set(p.post_id, [p]);
  }
  return map;
}

/** "+2 kişi daha", "3 kişi bu paylaşımdan", "Kimse gelmedi" */
export function peopleLine(count: number): string {
  if (!count) return "Kimse gelmedi";
  return count > TILE_AVATARS ? `+${count - TILE_AVATARS} kişi daha` : `${count} kişi bu paylaşımdan`;
}
