import { addDays } from "../dates";
import type { Ctx } from "../context";
import { queriesService } from "./queries";

/** "Bugün" ekranı: her bölüm {total, rows}, bölüm başına en fazla `limit` satır */
export function todayService(ctx: Ctx) {
  const q = queriesService(ctx);
  return function today(limit = 10) {
    const date = ctx.clock.today();
    const o = { limit };
    return {
      date,
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
    };
  };
}
