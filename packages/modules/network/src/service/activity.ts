// Dashboard grafikleri: günlük / haftalık / aylık temas sayıları, yeni kayıtlar, temas durumu dağılımı
import { addDays, CHANNELS, CONTACT_STATUSES, dayOf, FFError, rows, weekStart, type ActivityBucket, type ActivityReport, type Ctx } from "@fullfollow/core";

export const ACTIVITY_PERIODS = ["day", "week", "month"] as const;
export type ActivityPeriod = (typeof ACTIVITY_PERIODS)[number];
/** Grafikte kaç dilim: son 14 gün, 8 hafta, 6 ay */
const BUCKETS: Record<ActivityPeriod, number> = { day: 14, week: 8, month: 6 };

const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`;
function addMonths(ym01: string, n: number): string {
  const [y, m] = ym01.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
}

/**
 * Dönem dilimleri (eskiden yeniye) + son dilimin kanal kırılımı + kişi/firma temas durumu dağılımı (anlık).
 * Gün sınırları yerel saate göre (dates.dayOf).
 */
export function activity(ctx: Ctx, period: string = "week"): ActivityReport {
  if (!(ACTIVITY_PERIODS as readonly string[]).includes(period)) throw new FFError("validation", `dönem: ${ACTIVITY_PERIODS.join(", ")}`);
  const p = period as ActivityPeriod;
  const today = ctx.clock.today();
  const n = BUCKETS[p];
  const starts: string[] = [];
  const cur = p === "day" ? today : p === "week" ? weekStart(today) : monthStart(today);
  for (let i = n - 1; i >= 0; i--) starts.push(p === "day" ? addDays(cur, -i) : p === "week" ? addDays(cur, -7 * i) : addMonths(cur, -i));
  const next = (s: string) => (p === "day" ? addDays(s, 1) : p === "week" ? addDays(s, 7) : addMonths(s, 1));
  const buckets: ActivityBucket[] = starts.map((s) => ({ start: s, end: addDays(next(s), -1), sent: 0, replies: 0, meetings: 0, new_people: 0, new_companies: 0, drafts: 0, offers: 0 }));
  const indexOf = (day: string) => {
    for (let i = buckets.length - 1; i >= 0; i--) if (day >= buckets[i].start) return day <= buckets[i].end ? i : -1;
    return -1;
  };
  // UTC/yerel farkı için bir gün geniş çek, gün yerel saate göre ayrılır
  const since = addDays(starts[0], -1);
  const channels = new Map<string, { sent: number; replies: number }>();
  const last = buckets.length - 1;
  for (const t of rows<{ happened_at: string; direction: string; kind: string; channel: string }>(ctx,
    "SELECT happened_at, direction, kind, channel FROM touches WHERE happened_at >= ?", since)) {
    const i = indexOf(dayOf(t.happened_at));
    if (i < 0) continue;
    const b = buckets[i];
    if (t.direction === "giden") b.sent++;
    else b.replies++;
    if (t.kind === "gorusme" || t.kind === "arama") b.meetings++;
    if (i === last) {
      const c = channels.get(t.channel) ?? { sent: 0, replies: 0 };
      if (t.direction === "giden") c.sent++;
      else c.replies++;
      channels.set(t.channel, c);
    }
  }
  // TODO(modules): people and companies through ctx.mod, drafts through ctx.mod("drafts"), offers through ctx.mod("pipeline") (raw table reads for now)
  for (const [table, key] of [["people", "new_people"], ["companies", "new_companies"], ["drafts", "drafts"], ["offers", "offers"]] as const) {
    for (const r of rows<{ created_at: string }>(ctx, `SELECT created_at FROM ${table} WHERE created_at >= ?`, since)) {
      const i = indexOf(dayOf(r.created_at));
      if (i >= 0) buckets[i][key]++;
    }
  }
  const dist = (table: "people" | "companies") => {
    const m = new Map(rows<{ s: string; n: number }>(ctx, `SELECT contact_status s, COUNT(*) n FROM ${table} GROUP BY contact_status`).map((r) => [r.s, r.n]));
    return CONTACT_STATUSES.map((s) => ({ status: s, count: m.get(s) ?? 0 }));
  };
  return {
    period: p,
    buckets,
    current: buckets[last],
    previous: buckets[last - 1] ?? null,
    channels: CHANNELS.filter((c) => channels.has(c)).map((c) => ({ channel: c, ...channels.get(c)! })),
    status: { people: dist("people"), companies: dist("companies") },
  };
}
