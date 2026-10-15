import { FFError } from "./context";
import { m } from "./messages";

/** Nest injection token (a string, so module packages can use it without importing the server) of the composed app */
export const APP_TOKEN = "FF_APP";
/** Nest injection token of the same app acting as Claude (actor "claude"): work done on Claude's behalf, such as the follow-up drafts the scheduler writes */
export const CLAUDE_APP_TOKEN = "FF_APP_CLAUDE";

/** ?q=&limit=&offset= dışındaki tüm sorgu alanları filter olur */
export function listOpts(query: Record<string, any>) {
  const { q, limit, offset, ...filter } = query ?? {};
  return {
    q: q as string | undefined,
    limit: limit !== undefined ? Number(limit) : undefined,
    offset: offset !== undefined ? Number(offset) : undefined,
    filter,
  };
}

/** ?with=touches,tasks */
export const withList = (w?: string) => (w ? String(w).split(",").map((s) => s.trim()).filter(Boolean) : []);

/** A positive integer id from a URL; anything else is a 400 (code "http") */
export function intId(v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new FFError("http", m.invalidId(v));
  return n;
}
