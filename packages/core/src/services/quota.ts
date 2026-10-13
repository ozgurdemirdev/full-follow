import { CHANNELS, label, QUOTA_NEAR_RATIO, type Channel } from "../constants";
import { row, rows, type Ctx } from "../context";
import { marketingSettings } from "./settings";
import type { ResolvedSubject } from "./subject";

/** ok = under the near threshold, near = close to the limit, over = limit reached or passed */
export type QuotaState = "ok" | "near" | "over";

export interface ChannelQuota {
  channel: Channel;
  sent: number;
  limit: number;
  state: QuotaState;
}

export interface Quota {
  date: string;
  /** Only channels that have a daily limit, in channel order */
  channels: ChannelQuota[];
  /** Cold email is off until `until` (inclusive) */
  email_warmup: { until: string | null; active: boolean };
}

/** Outgoing messages per channel and day ("channel|date" → count); daily goals and the daily quota both count from here */
export function outgoingMessageCounts(ctx: Ctx, from: string, to: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows<{ channel: string; d: string; n: number }>(ctx, `SELECT channel, substr(happened_at, 1, 10) AS d, COUNT(*) AS n
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
  const channels = CHANNELS.flatMap((channel) => {
    const limit = channel_limits[channel];
    if (!limit) return [];
    const sent = counts.get(`${channel}|${date}`) ?? 0;
    return [{ channel, sent, limit, state: stateOf(sent, limit) }];
  });
  return { date, channels, email_warmup: { until: email_warmup_until || null, active: !!email_warmup_until && date <= email_warmup_until } };
}

const dayMonth = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** Cold email: an outgoing email message to a recipient (person, company or bare address) with no earlier touch at all. Call before inserting the touch. */
export function isColdEmail(ctx: Ctx, t: { channel: string; direction: string; kind: string }, s: ResolvedSubject): boolean {
  if (t.channel !== "email" || t.direction !== "giden" || t.kind !== "mesaj") return false;
  const [column, value] = s.person_id ? ["person_id", s.person_id] : s.company_id ? ["company_id", s.company_id] : ["contact_key", s.contact_key];
  return !row(ctx, `SELECT 1 FROM touches WHERE ${column} = ? LIMIT 1`, value);
}

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
