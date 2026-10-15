import { LIST_LIMIT_MAX } from "./constants";
import { FFError } from "./context";
import { m } from "./messages";

/** Nest injection token (a string, so module packages can use it without importing the server) of the composed app */
export const APP_TOKEN = "FF_APP";
/** Nest injection token of the same app acting as Claude (actor "claude"): work done on Claude's behalf, such as the follow-up drafts the scheduler writes */
export const CLAUDE_APP_TOKEN = "FF_APP_CLAUDE";

/** An integer query value within min..max; a missing one is undefined, anything else (text, a decimal, out of range) is a 400 (code "http") */
export function intQuery(name: string, value: unknown, min: number, max: number): number | undefined {
  if (value === undefined || value === "") return undefined;
  const n = typeof value === "string" && /^[+-]?\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new FFError("http", m.invalidNumber(name, min, max));
  return n;
}

/** `limit` of a list: a positive integer, anything above LIST_LIMIT_MAX is cut to it; undefined when the request gives none */
export function listLimit(value: unknown): number | undefined {
  const n = intQuery("limit", value, 1, Number.MAX_SAFE_INTEGER);
  return n === undefined ? undefined : Math.min(n, LIST_LIMIT_MAX);
}

/** ?q=&limit=&offset= dışındaki tüm sorgu alanları filter olur */
export function listOpts(query: Record<string, any>) {
  const { q, limit, offset, ...filter } = query ?? {};
  return { q: q as string | undefined, limit: listLimit(limit), offset: intQuery("offset", offset, 0, Number.MAX_SAFE_INTEGER), filter };
}

/** ?with=touches,tasks */
export const withList = (w?: string) => (w ? String(w).split(",").map((s) => s.trim()).filter(Boolean) : []);

/** A positive integer id from a URL; anything else is a 400 (code "http") */
export function intId(v: string): number {
  const n = /^\d+$/.test(v) ? Number(v) : Number.NaN;
  if (!Number.isSafeInteger(n) || n <= 0) throw new FFError("http", m.invalidId(v));
  return n;
}
