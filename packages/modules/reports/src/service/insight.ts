import { INSIGHT_NEAR_SHARE, INSIGHT_TEXT, MONTH_NAMES } from "../constants";

type Key = keyof typeof INSIGHT_TEXT;

/** What the sentence is built from: a month's collections, what is still due in it, the floor and the opportunities lost in it (null without the pipeline module) */
export interface InsightInput {
  month: string;
  /** the month of today: the sentence looks ahead in it, and back in an earlier one */
  current: string;
  collected: number;
  due: number;
  floor: number;
  lost: { count: number; budget: number } | null;
}

const tl = (n: number) => `₺${Math.round(n).toLocaleString("tr-TR")}`;
const say = (key: Key, vars: Record<string, string>) => INSIGHT_TEXT[key].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");

/**
 * One Turkish sentence about a month against the floor. The current month looks ahead: the floor is reached, or the due payments would reach it,
 * or the gap that stays. A past month looks back (above or under the floor, and what was lost in it). A coming month and a floor of zero say nothing.
 */
export function insightOf(i: InsightInput): string | null {
  if (i.floor <= 0 || i.month > i.current) return null;
  if (i.month < i.current) {
    const month = MONTH_NAMES[Number(i.month.slice(5, 7)) - 1];
    if (i.collected >= i.floor) return say("pastAbove", { month });
    const lost = i.lost?.count ? say(i.lost.budget ? "lost" : "lostNoBudget", { count: String(i.lost.count), budget: tl(i.lost.budget) }) : "";
    return say("pastBelow", { month }) + lost;
  }
  if (i.collected >= i.floor) return INSIGHT_TEXT.reached;
  const gap = i.floor - i.collected;
  if (i.due <= 0) return say("nothingDue", { gap: tl(gap) });
  if (i.due >= gap) return say("covered", { due: tl(i.due), surplus: tl(i.due - gap) });
  const missing = gap - i.due;
  return say(missing <= i.floor * INSIGHT_NEAR_SHARE ? "near" : "short", { due: tl(i.due), missing: tl(missing) });
}
