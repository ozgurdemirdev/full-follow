import { CHANNELS } from "../constants";
import { addDays } from "../dates";
import { rows, type Ctx } from "../context";
import { ideaStats } from "./ideas";

/**
 * Kanal performansı (son `days` gün): kaç kişiye yazıldı, kaçı sonra döndü, oran.
 * Kişi bazında sayılır: aynı kişiye 3 mesaj = 1 kişi.
 */
export function channelPerformance(ctx: Ctx, days = 30) {
  const since = addDays(ctx.clock.today(), -days);
  const list = rows<{ channel: string; people: number; replied: number; sent: number }>(ctx, `
    WITH o AS (
      SELECT channel, person_id, MIN(happened_at) AS first_at, COUNT(*) AS n FROM touches
      WHERE direction = 'giden' AND substr(happened_at, 1, 10) >= ? GROUP BY channel, person_id
    )
    SELECT o.channel, COUNT(*) AS people, SUM(o.n) AS sent,
      SUM(EXISTS (SELECT 1 FROM touches g WHERE g.person_id = o.person_id AND g.direction = 'gelen' AND g.happened_at > o.first_at)) AS replied
    FROM o GROUP BY o.channel`, since);
  return CHANNELS.map((c) => list.find((x) => x.channel === c)).filter((x): x is NonNullable<typeof x> => !!x)
    .map((x) => ({ ...x, reply_rate: x.people ? x.replied / x.people : null }));
}

/** Pazarlama özeti: paylaşımlar (getirdikleri), fikirler (ilgi), şablonlar (tür ve kanal gruplarında kıyas), kanal performansı, takip dizisi; kurulu olmayan modülün parçası boş gelir */
export function marketingReport(ctx: Ctx) {
  // posts come from the posts module; without it the lists are empty
  const posts = ctx.mod("posts")?.stats() ?? [];
  return {
    posts: posts.slice().sort((a, b) => b.won_value - a.won_value || b.people_count - a.people_count || b.opp_count - a.opp_count),
    posts_due: posts.filter((p) => p.refresh_due),
    ideas: ideaStats(ctx),
    template_groups: ctx.mod("templates")?.comparison() ?? [],
    channels: channelPerformance(ctx, 30),
    followups: ctx.mod("drafts")?.followups.due() ?? [],
  };
}
