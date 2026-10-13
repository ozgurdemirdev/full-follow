import { CHANNELS, CONNECTION_TAGS, NETWORK_DEFAULTS, OPEN_OPP_STAGES } from "../constants";
import { addDays, dayOf, daysBetween, weekStart } from "../dates";
import { row, rows, type Ctx } from "../context";
import { sectorsOf, tagsOf } from "./categories";
import { marketingSettings, readSetting } from "./settings";

/** Kişinin temas durumu (hesaplanır, saklanmaz) */
export interface PersonNet {
  last_touch_at: string | null;
  last_channel: string | null;
  last_direction: "giden" | "gelen" | null;
  last_in_at: string | null;
  /** son temastan (yoksa eklenmeden) bu yana gün */
  days_since: number;
  /** son gelen temastan sonra cevap bekleyen giden temas varsa */
  awaiting: { since: string; channel: string; days: number; attempts: number; late: boolean } | null;
  cooling: boolean;
}

export function networkSettings(ctx: Ctx) {
  const n = (k: keyof typeof NETWORK_DEFAULTS) => {
    const v = readSetting(ctx, k);
    return v === undefined ? NETWORK_DEFAULTS[k] : Number(v) || NETWORK_DEFAULTS[k];
  };
  return { reply_wait_days: n("reply_wait_days"), cooling_days: n("cooling_days"), ...marketingSettings(ctx) };
}

const OPEN = OPEN_OPP_STAGES.map((s) => `'${s}'`).join(",");

/**
 * Tüm kişilerin temas durumu tek sorguda (kişi sayısı küçük; listeler bunu kullanır).
 * Cevap bekleyen: kişiden ya da firmasından (firma adına veya bir çalışanından) gelen son temastan sonra expects_reply'li giden temas.
 * Soğuyan: bağlantı (gelen teması ya da bağlantı etiketi var) + son temas eşikten eski + cevap beklemiyor + takip tarihi yok.
 */
export function networkStats(ctx: Ctx): Map<number, PersonNet> {
  const today = ctx.clock.today();
  const cfg = networkSettings(ctx);
  const tags = CONNECTION_TAGS.map((t) => `'${t}'`).join(",");
  const list = rows(ctx, `
    WITH agg AS (
      SELECT person_id, MAX(happened_at) AS last_at, MAX(CASE WHEN direction = 'gelen' THEN happened_at END) AS last_in
      FROM touches WHERE person_id IS NOT NULL GROUP BY person_id
    ), cin AS (
      SELECT cid, MAX(at) AS at FROM (
        SELECT company_id AS cid, happened_at AS at FROM touches WHERE direction = 'gelen' AND company_id IS NOT NULL
        UNION ALL SELECT p.company_id, t.happened_at FROM touches t JOIN people p ON p.id = t.person_id WHERE t.direction = 'gelen' AND p.company_id IS NOT NULL
      ) GROUP BY cid
    ), pend AS (
      SELECT t.person_id, COUNT(*) AS attempts, MAX(t.happened_at) AS last_out
      FROM touches t JOIN agg a ON a.person_id = t.person_id JOIN people tp ON tp.id = t.person_id LEFT JOIN cin c ON c.cid = tp.company_id
      WHERE t.direction = 'giden' AND t.expects_reply = 1 AND (a.last_in IS NULL OR t.happened_at > a.last_in) AND (c.at IS NULL OR t.happened_at > c.at)
      GROUP BY t.person_id
    )
    SELECT p.id, p.created_at, p.next_follow_up_at, a.last_at, a.last_in, d.attempts, d.last_out,
      (SELECT channel || '|' || direction FROM touches x WHERE x.person_id = p.id ORDER BY x.happened_at DESC, x.id DESC LIMIT 1) AS last_cd,
      (SELECT channel FROM touches x WHERE x.person_id = p.id AND x.direction = 'giden' AND x.expects_reply = 1 AND x.happened_at = d.last_out ORDER BY x.id DESC LIMIT 1) AS await_channel,
      EXISTS (SELECT 1 FROM person_tags g JOIN tags tg ON tg.id = g.tag_id WHERE g.person_id = p.id AND tg.slug IN (${tags})) AS tagged
    FROM people p LEFT JOIN agg a ON a.person_id = p.id LEFT JOIN pend d ON d.person_id = p.id`);

  const out = new Map<number, PersonNet>();
  for (const r of list) {
    const [ch, dir] = r.last_cd ? String(r.last_cd).split("|") : [null, null];
    const ref = r.last_at ?? r.created_at;
    const days_since = Math.max(0, daysBetween(dayOf(ref), today));
    const awaiting = r.attempts
      ? (() => {
          const days = Math.max(0, daysBetween(dayOf(r.last_out), today));
          return { since: r.last_out, channel: r.await_channel ?? ch, days, attempts: r.attempts, late: days >= cfg.reply_wait_days };
        })()
      : null;
    const connection = !!r.last_in || !!r.tagged;
    out.set(r.id, {
      last_touch_at: r.last_at ?? null, last_channel: ch, last_direction: dir as PersonNet["last_direction"], last_in_at: r.last_in ?? null,
      days_since, awaiting,
      cooling: connection && !awaiting && !r.next_follow_up_at && days_since >= cfg.cooling_days,
    });
  }
  return out;
}

/** Bir kişinin kanal kanal temas özeti */
export function channelSummary(ctx: Ctx, personId: number, net?: PersonNet) {
  const list = rows(ctx, `
    SELECT channel, COUNT(*) AS total, SUM(direction = 'giden') AS out_count, SUM(direction = 'gelen') AS in_count, MAX(happened_at) AS last_at
    FROM touches WHERE person_id = ? GROUP BY channel ORDER BY last_at DESC`, personId);
  return list.map((c) => ({ ...c, awaiting: !!net?.awaiting && net.awaiting.channel === c.channel }));
}

/** Referans değeri: her tanıtan için alt ağaçtaki kişilerden gelen fırsat ve iş */
export function referralValues(ctx: Ctx) {
  const people = rows<{ id: number; name: string; referred_by_id: number | null; company_name: string | null }>(ctx,
    "SELECT p.id, p.name, p.referred_by_id, c.name AS company_name FROM people p LEFT JOIN companies c ON c.id = p.company_id");
  const opp = new Map(rows(ctx, `
    SELECT person_id, COUNT(*) AS opps, SUM(stage = 'kazanildi') AS won,
      COALESCE(SUM(CASE WHEN stage = 'kazanildi' THEN COALESCE(estimated_value, 0) END), 0) AS won_value,
      COALESCE(SUM(CASE WHEN stage IN (${OPEN}) THEN COALESCE(estimated_value, 0) END), 0) AS open_value
    FROM opportunities GROUP BY person_id`).map((r) => [r.person_id as number, r]));
  const work = new Map(rows(ctx, `
    SELECT pr.person_id, COUNT(DISTINCT pr.id) AS projects, COALESCE(SUM(pa.paid_amount), 0) AS collected
    FROM projects pr LEFT JOIN payments pa ON pa.project_id = pr.id GROUP BY pr.person_id`).map((r) => [r.person_id as number, r]));
  const kids = new Map<number, number[]>();
  for (const p of people) if (p.referred_by_id) kids.set(p.referred_by_id, [...(kids.get(p.referred_by_id) ?? []), p.id]);

  const result = [];
  for (const p of people) {
    const direct = kids.get(p.id) ?? [];
    if (!direct.length) continue;
    const v = { opps: 0, won: 0, won_value: 0, open_value: 0, projects: 0, collected: 0 };
    const seen = new Set<number>([p.id]);
    const stack = [...direct];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const o = opp.get(id);
      const w = work.get(id);
      if (o) { v.opps += o.opps; v.won += o.won; v.won_value += o.won_value; v.open_value += o.open_value; }
      if (w) { v.projects += w.projects; v.collected += w.collected; }
      stack.push(...(kids.get(id) ?? []));
    }
    result.push({ person_id: p.id, name: p.name, company_name: p.company_name, direct: direct.length, network: seen.size - 1, ...v });
  }
  return result.sort((a, b) => b.won_value - a.won_value || b.collected - a.collected || b.opps - a.opps || b.network - a.network || a.name.localeCompare(b.name, "tr"));
}

/**
 * Haftalık temas sayıları: `ref` gününün haftası (pazartesiden; varsayılan bugün) ve bir önceki hafta, kanal kırılımıyla.
 * Yeni kayıt sayıları kişi ve firma ayrı. Açık teklif sayıları o anki durumdur, haftaya bağlı değildir.
 */
export function weekStats(ctx: Ctx, ref = ctx.clock.today()) {
  const today = ctx.clock.today();
  const ws = weekStart(ref);
  const prev = addDays(ws, -7);
  // gelecek günlerin temasları sayılmaz
  const until = addDays(ws, 6) < today ? addDays(ws, 6) : today;
  // UTC/yerel farkı için bir gün geniş çek, gün yerel saate göre ayrılır
  const list = rows<{ happened_at: string; direction: string; kind: string; channel: string }>(ctx,
    "SELECT happened_at, direction, kind, channel FROM touches WHERE happened_at >= ?", addDays(prev, -1));
  const blank = () => ({ sent: 0, replies: 0, meetings: 0 });
  const cur = blank();
  const last = blank();
  const by = new Map<string, { sent: number; replies: number }>();
  for (const t of list) {
    const d = dayOf(t.happened_at);
    if (d < prev || d > until) continue;
    const bucket = d >= ws ? cur : last;
    if (t.direction === "giden") bucket.sent++;
    else bucket.replies++;
    if (t.kind === "gorusme") bucket.meetings++;
    if (d >= ws) {
      const c = by.get(t.channel) ?? { sent: 0, replies: 0 };
      if (t.direction === "giden") c.sent++;
      else c.replies++;
      by.set(t.channel, c);
    }
  }
  const newRecords = (table: "people" | "companies", from: string, to: string) =>
    rows<{ created_at: string }>(ctx, `SELECT created_at FROM ${table} WHERE created_at >= ?`, addDays(from, -1))
      .filter((p) => { const d = dayOf(p.created_at); return d >= from && d <= to; }).length;
  const offers = rows<{ updated_at: string }>(ctx, "SELECT updated_at FROM opportunities WHERE stage = 'teklif'");
  const rate = (b: { sent: number; replies: number }) => (b.sent ? b.replies / b.sent : null);
  return {
    week_start: ws,
    this_week: { ...cur, reply_rate: rate(cur), new_people: newRecords("people", ws, until), new_companies: newRecords("companies", ws, until) },
    last_week: { ...last, reply_rate: rate(last), new_people: newRecords("people", prev, addDays(ws, -1)), new_companies: newRecords("companies", prev, addDays(ws, -1)) },
    by_channel: CHANNELS.filter((c) => by.has(c)).map((c) => ({ channel: c, ...by.get(c)! })),
    open_offers: offers.length,
    silent_offers: offers.filter((o) => daysBetween(dayOf(o.updated_at), today) >= 3).length,
  };
}

/** Bugün ekranının network bölümleri: cevap bekleyenler ve soğuyanlar */
export function networkLists(ctx: Ctx, limit = 10) {
  const stats = networkStats(ctx);
  const tags = tagsOf(ctx, "person");
  const sectors = sectorsOf(ctx, "person");
  const people = rows(ctx, `SELECT p.id, p.name, p.company_id, p.contact_status, p.next_follow_up_at, p.created_by, c.name AS company_name
    FROM people p LEFT JOIN companies c ON c.id = p.company_id`)
    .map((p) => ({ ...p, ...labelFields(tags.get(p.id), sectors.get(p.id)), ...stats.get(p.id)! }));
  const awaiting = people.filter((p) => p.awaiting).sort((a, b) => b.awaiting!.days - a.awaiting!.days || a.name.localeCompare(b.name, "tr"));
  const cooling = people.filter((p) => p.cooling).sort((a, b) => b.days_since - a.days_since || a.name.localeCompare(b.name, "tr"));
  const cut = <T>(l: T[]) => ({ rows: l.slice(0, limit), total: l.length });
  return { awaiting: cut(awaiting), cooling: cut(cooling), settings: networkSettings(ctx) };
}

/** Kişinin cevap bekleme durumu tek kişi için (kart) */
export function personNet(ctx: Ctx, personId: number): PersonNet | undefined {
  return networkStats(ctx).get(personId);
}

export const hasTouches = (ctx: Ctx, personId: number) => !!row(ctx, "SELECT 1 x FROM touches WHERE person_id = ? LIMIT 1", personId);

/** Liste satırındaki etiket ve sektör alanları (web etiketi id ile, MCP adla gösterir) */
export function labelFields(
  tags: { id: number; name: string }[] | undefined,
  sectors: { id: number; path: string }[] | undefined,
) {
  return {
    tags: (tags ?? []).map((t) => t.name), tag_ids: (tags ?? []).map((t) => t.id),
    sectors: sectors ?? [], sector_path: sectors?.length ? sectors.map((x) => x.path).join(", ") : null,
  };
}
