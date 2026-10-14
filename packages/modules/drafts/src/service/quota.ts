import {
  addDays, CHANNELS, keptRows, label, marketingSettings, QUOTA_NEAR_RATIO,
  type Channel, type Ctx, type Quota, type QuotaOverDays, type QuotaState,
} from "@fullfollow/core";

/** Outgoing messages per channel and day ("channel|date" → count); daily goals and the daily quota both count from here */
export function outgoingMessageCounts(ctx: Ctx, from: string, to: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of keptRows<{ channel: string; d: string; n: number }>(ctx, `SELECT channel, substr(happened_at, 1, 10) AS d, COUNT(*) AS n
      FROM touches WHERE direction = 'giden' AND kind = 'mesaj' AND substr(happened_at, 1, 10) BETWEEN ? AND ? GROUP BY channel, d`, from, to)) {
    m.set(`${r.channel}|${r.d}`, r.n);
  }
  return m;
}

const stateOf = (sent: number, limit: number): QuotaState => (sent >= limit ? "over" : sent >= limit * QUOTA_NEAR_RATIO ? "near" : "ok");

/** Per limited channel: messages sent that day against the daily limit, plus the email warmup state */
export function quotaFor(ctx: Ctx, date: string): Quota {
  const { channel_limits, email_warmup_until } = marketingSettings(ctx);
  const counts = outgoingMessageCounts(ctx, date, date);
  const channels = CHANNELS.flatMap((channel: Channel) => {
    const limit = channel_limits[channel];
    if (!limit) return [];
    const sent = counts.get(`${channel}|${date}`) ?? 0;
    return [{ channel, sent, limit, state: stateOf(sent, limit) }];
  });
  return { date, channels, email_warmup: { until: email_warmup_until || null, active: !!email_warmup_until && date <= email_warmup_until } };
}

/** Per limited channel: on how many days from..to the limit was reached or passed, and the most sent in a day */
export function quotaOverDays(ctx: Ctx, from: string, to: string): QuotaOverDays[] {
  const { channel_limits } = marketingSettings(ctx);
  const counts = outgoingMessageCounts(ctx, from, to);
  return CHANNELS.flatMap((channel: Channel) => {
    const limit = channel_limits[channel];
    if (!limit) return [];
    let over_days = 0;
    let max_sent = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const sent = counts.get(`${channel}|${d}`) ?? 0;
      max_sent = Math.max(max_sent, sent);
      if (stateOf(sent, limit) === "over") over_days++;
    }
    return [{ channel, limit, over_days, max_sent }];
  });
}

const dayMonth = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/**
 * Send time warnings (never a block): the channel reached or passed its daily limit, or a cold email went out during warmup.
 * Call after the touch is inserted so it is part of the count; touches dated another day are not warned about.
 */
export function sendWarnings(ctx: Ctx, t: { channel: string; direction: string; kind: string }, day: string, cold: boolean): string[] {
  if (t.direction !== "giden" || t.kind !== "mesaj" || day !== ctx.clock.today()) return [];
  const q = quotaFor(ctx, day);
  const out: string[] = [];
  const c = q.channels.find((x) => x.channel === t.channel);
  if (c?.state === "over") out.push(`Uyarı: ${label(c.channel)} günlük limiti ${c.sent > c.limit ? "aşıldı" : "doldu"} (${c.sent}/${c.limit})`);
  if (cold && q.email_warmup.active) out.push(`Uyarı: soğuk e-posta ısınma döneminde kapalı (${dayMonth(q.email_warmup.until!)} tarihine kadar)`);
  return out;
}
