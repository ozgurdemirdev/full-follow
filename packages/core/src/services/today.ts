import { addDays } from "../dates";
import { row } from "../context";
import type { Ctx } from "../context";
import { networkLists, weekStats } from "./network";
import { queriesService } from "./queries";
import { followupsDue } from "./followups";
import { goalsService } from "./goals";
import { quotaFor } from "./quota";

/** "Bugün" ekranı: her bölüm {total, rows}, bölüm başına en fazla `limit` satır */
export function todayService(ctx: Ctx) {
  const q = queriesService(ctx);
  /** Bu hafta (pazartesiden) ve geçen hafta temas sayıları + açık teklifler */
  function week(date: string) {
    const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const start = addDays(date, -day);
    const prev = addDays(start, -7);
    const t = row<{ sent: number; sent_prev: number; replies: number; meetings: number }>(ctx, `SELECT
        SUM(direction = 'giden' AND substr(happened_at, 1, 10) >= ?) AS sent,
        SUM(direction = 'giden' AND substr(happened_at, 1, 10) < ?) AS sent_prev,
        SUM(direction = 'gelen' AND substr(happened_at, 1, 10) >= ?) AS replies,
        SUM(kind = 'gorusme' AND substr(happened_at, 1, 10) >= ?) AS meetings
      FROM touches WHERE substr(happened_at, 1, 10) >= ?`, start, start, start, start, prev);
    const o = row<{ offers: number; silent: number }>(ctx, `SELECT COUNT(*) AS offers,
        SUM(substr(updated_at, 1, 10) <= ?) AS silent FROM opportunities WHERE stage = 'teklif'`, addDays(date, -3));
    return {
      start, sent: t?.sent ?? 0, sent_prev: t?.sent_prev ?? 0, replies: t?.replies ?? 0, meetings: t?.meetings ?? 0,
      offers: o?.offers ?? 0, offers_silent: o?.silent ?? 0,
    };
  }

  const goals = goalsService(ctx);

  return function today(limit = 10) {
    const date = ctx.clock.today();
    const o = { limit };
    return {
      date,
      // günlük iş planı: hedefler ve o günün görevleri
      plan: goals.plan(date),
      // Claude'un cevap vermesi gereken yorumlar (son yorum Özgür'den)
      comments: q.comments({ ...o, filter: { unanswered: true } }),
      drafts: q.drafts({ ...o, filter: { status: "bekliyor" } }),
      follow_ups: {
        people: q.people({ ...o, filter: { follow_up_due: true } }),
        opportunities: q.opportunities({ ...o, filter: { due: true } }),
      },
      tasks: q.tasks({ ...o, filter: { due: true } }),
      payments: q.payments({ ...o, filter: { due_within_days: 7 } }),
      window_end: addDays(date, 7),
      // network: cevap bekleyenler (kanal, gün, deneme) ve soğuyan bağlantılar
      network: networkLists(ctx, limit),
      // Paket 2: güncellenecek paylaşımlar ve zamanı gelen takipler (taslak bekleyen)
      posts_due: q.posts({ limit, filter: { refresh_due: true } }),
      followups: (() => { const l = followupsDue(ctx); return { rows: l.slice(0, limit), total: l.length }; })(),
      // daily quota per channel and the email warmup state
      quota: quotaFor(ctx, date),
      week: (() => {
        const w = weekStats(ctx);
        return { ...week(date), replies_prev: w.last_week.replies, new_people: w.this_week.new_people, by_channel: w.by_channel };
      })(),
      // Claude'un MCP üzerinden yaptığı son işlem (bağlı mı, ne zaman çalıştı)
      claude_last_at: row<{ at: string | null }>(ctx, "SELECT MAX(created_at) AS at FROM events WHERE created_by = 'claude'")?.at ?? null,
    };
  };
}
