import { REVIEW_WEEKDAY } from "../constants";
import { addDays, isoWeekday, isoWeekOf } from "../dates";
import { row } from "../context";
import type { Ctx } from "../context";
import { queriesFor } from "./queries";
import { followupsDue } from "./followups";
import { quotaFor } from "./quota";

/** "Bugün" ekranı: her bölüm {total, rows}, bölüm başına en fazla `limit` satır */
export function todayService(ctx: Ctx) {
  const q = queriesFor(ctx);

  return function today(limit = 10) {
    const date = ctx.clock.today();
    const o = { limit };
    return {
      date,
      // Claude'un cevap vermesi gereken yorumlar (son yorum Özgür'den)
      comments: q.comments({ ...o, filter: { unanswered: true } }),
      drafts: q.drafts({ ...o, filter: { status: "bekliyor" } }),
      follow_ups: {
        people: ctx.mod("people")?.list({ ...o, filter: { follow_up_due: true } }) ?? { rows: [], total: 0 },
        opportunities: ctx.mod("pipeline")?.opportunities.list({ ...o, filter: { due: true } }) ?? { rows: [], total: 0 },
      },
      window_end: addDays(date, 7),
      // Paket 2: güncellenecek paylaşımlar ve zamanı gelen takipler (taslak bekleyen)
      followups: (() => { const l = followupsDue(ctx); return { rows: l.slice(0, limit), total: l.length }; })(),
      // the weekly review of the current week; ready on Fridays (the dashboard links to it)
      review: { week: isoWeekOf(date), ready: isoWeekday(date) === REVIEW_WEEKDAY },
      // daily quota per channel and the email warmup state
      quota: quotaFor(ctx, date),
      // Claude'un MCP üzerinden yaptığı son işlem (bağlı mı, ne zaman çalıştı)
      claude_last_at: row<{ at: string | null }>(ctx, "SELECT MAX(created_at) AS at FROM events WHERE created_by = 'claude'")?.at ?? null,
      // sections the installed modules add (the day plan and tasks of the calendar, the network lists and the week numbers, ...)
      ...Object.assign({}, ...ctx.contrib("today").map((section) => section(ctx, { limit }))),
    };
  };
}
