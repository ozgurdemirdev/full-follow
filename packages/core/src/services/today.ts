import { addDays } from "../dates";
import { row } from "../context";
import type { Ctx } from "../context";
import { queriesFor } from "./queries";

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Sections of the installed modules into one object; two modules that fill the same key (the follow-ups of people and of opportunities) are merged one level deep */
function mergeSections(list: Record<string, unknown>[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const section of list) {
    for (const [key, value] of Object.entries(section)) out[key] = isPlain(out[key]) && isPlain(value) ? { ...out[key], ...value } : value;
  }
  return out;
}

/** "Bugün" ekranı: her bölüm {total, rows}, bölüm başına en fazla `limit` satır */
export function todayService(ctx: Ctx) {
  const q = queriesFor(ctx);

  return function today(limit = 10) {
    const date = ctx.clock.today();
    const o = { limit };
    return {
      date,
      // Claude'un cevap vermesi gereken yorumlar (son yorum kullanıcıdan)
      comments: q.comments({ ...o, filter: { unanswered: true } }),
      window_end: addDays(date, 7),
      // Claude'un MCP üzerinden yaptığı son işlem (bağlı mı, ne zaman çalıştı)
      claude_last_at: row<{ at: string | null }>(ctx, "SELECT MAX(created_at) AS at FROM events WHERE created_by = 'claude'")?.at ?? null,
      // sections the installed modules add (the day plan and tasks, the drafts, follow-ups of people and opportunities, the network lists, the weekly review, ...)
      ...mergeSections(ctx.contrib("today").map((section) => section(ctx, { limit }))),
    };
  };
}
