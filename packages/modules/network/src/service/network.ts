import {
  addDays, CHANNELS, CONNECTION_TAGS, COMPANY_TOUCHES, dayOf, daysBetween, inIds, labelFields, LOCALE, localDay, networkSettings, RHYTHM_WEEKS, rows, sectorsOf, tagsOf, weekStart,
  type ChannelSummary, type Ctx, type NetworkLists, type PersonNet, type WeekStats,
} from "@fullfollow/core";
import { NETWORK_LIST_LIMIT, SILENT_OFFER_DAYS, WEEK_DAYS } from "./constants";

/**
 * Tüm kişilerin temas durumu tek sorguda (kişi sayısı küçük; listeler bunu kullanır).
 * Cevap bekleyen: kişiden ya da firmasından (firma adına veya bir çalışanından) gelen son temastan sonra expects_reply'li giden temas.
 * Soğuyan: bağlantı (gelen teması ya da bağlantı etiketi var) + son temas eşikten eski + cevap beklemiyor + takip tarihi yok.
 * `ids` computes it only for those people (a single record read does not scan every touch).
 */
export function networkStats(ctx: Ctx, ids?: number[]): Map<number, PersonNet> {
  const today = ctx.clock.today();
  const cfg = networkSettings(ctx);
  const tags = CONNECTION_TAGS.map((t) => `'${t}'`).join(",");
  // the scope narrows the touch aggregates themselves (the people's own touches, the incoming touches of their companies), not only the final rows
  const ofPeople = ids ? `AND ${inIds("person_id")}` : "";
  const ofCompanies = (col: string) => (ids ? `AND ${col} IN (SELECT company_id FROM people WHERE ${inIds("id")})` : "");
  const json = ids ? [JSON.stringify(ids)] : [];
  const list = rows(ctx, `
    WITH agg AS (
      SELECT person_id, MAX(happened_at) AS last_at, MAX(CASE WHEN direction = 'gelen' THEN happened_at END) AS last_in
      FROM touches WHERE person_id IS NOT NULL ${ofPeople} GROUP BY person_id
    ), cin AS (
      SELECT cid, MAX(at) AS at FROM (
        SELECT company_id AS cid, happened_at AS at FROM touches WHERE direction = 'gelen' AND company_id IS NOT NULL ${ofCompanies("company_id")}
        UNION ALL SELECT p.company_id, t.happened_at FROM touches t JOIN people p ON p.id = t.person_id WHERE t.direction = 'gelen' AND p.company_id IS NOT NULL ${ofCompanies("p.company_id")}
      ) GROUP BY cid
    ), pend AS (
      SELECT t.person_id, COUNT(*) AS attempts, MAX(t.happened_at) AS last_out
      FROM touches t JOIN agg a ON a.person_id = t.person_id JOIN people tp ON tp.id = t.person_id LEFT JOIN cin c ON c.cid = tp.company_id
      WHERE t.direction = 'giden' AND t.expects_reply = 1 AND (a.last_in IS NULL OR t.happened_at > a.last_in) AND (c.at IS NULL OR t.happened_at > c.at)
      GROUP BY t.person_id
    )
    SELECT p.id, p.created_at, p.next_follow_up_at, a.last_at, a.last_in, d.attempts, d.last_out,
      (SELECT channel || '|' || direction FROM touches x WHERE x.person_id = p.id ORDER BY x.happened_at DESC, x.id DESC LIMIT 1) AS last_cd,
      (SELECT summary FROM touches x WHERE x.person_id = p.id ORDER BY x.happened_at DESC, x.id DESC LIMIT 1) AS last_summary,
      (SELECT channel FROM touches x WHERE x.person_id = p.id AND x.direction = 'giden' AND x.expects_reply = 1 AND x.happened_at = d.last_out ORDER BY x.id DESC LIMIT 1) AS await_channel,
      EXISTS (SELECT 1 FROM person_tags g JOIN tags tg ON tg.id = g.tag_id WHERE g.person_id = p.id AND tg.slug IN (${tags})) AS tagged
    FROM people p LEFT JOIN agg a ON a.person_id = p.id LEFT JOIN pend d ON d.person_id = p.id ${ids ? `WHERE ${inIds("p.id")}` : ""}`,
  ...json, ...json, ...json, ...json);

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
      last_touch_at: r.last_at ?? null, last_channel: ch, last_direction: dir as PersonNet["last_direction"], last_summary: r.last_summary ?? null, last_in_at: r.last_in ?? null,
      days_since, awaiting,
      cooling: connection && !awaiting && !r.next_follow_up_at && days_since >= cfg.cooling_days,
    });
  }
  return out;
}

/**
 * Weekly contact rhythm: per person, touch counts of the last RHYTHM_WEEKS ISO weeks (Monday weeks), oldest first,
 * the current week last. One grouped query for everyone; people without touches are not in the map.
 */
export function weeklyRhythm(ctx: Ctx, ids?: number[]): Map<number, number[]> {
  const first = addDays(weekStart(ctx.clock.today()), -WEEK_DAYS * (RHYTHM_WEEKS - 1));
  // one day wider than the window: the day is cut by local time below
  const list = rows<{ person_id: number; happened_at: string; n: number }>(ctx,
    `SELECT person_id, happened_at, COUNT(*) AS n FROM touches WHERE person_id IS NOT NULL AND happened_at >= ? ${ids ? `AND ${inIds("person_id")}` : ""} GROUP BY person_id, happened_at`,
    addDays(first, -1), ...(ids ? [JSON.stringify(ids)] : []));
  const out = new Map<number, number[]>();
  for (const t of list) {
    const week = Math.floor(daysBetween(first, dayOf(t.happened_at)) / WEEK_DAYS);
    if (week < 0 || week >= RHYTHM_WEEKS) continue;
    const counts = out.get(t.person_id) ?? new Array<number>(RHYTHM_WEEKS).fill(0);
    counts[week] += t.n;
    out.set(t.person_id, counts);
  }
  return out;
}

/** Bir kişinin kanal kanal temas özeti */
export function channelSummary(ctx: Ctx, personId: number, net?: Pick<PersonNet, "awaiting">): ChannelSummary[] {
  const list = rows<ChannelSummary>(ctx, `
    SELECT channel, COUNT(*) AS total, SUM(direction = 'giden') AS out_count, SUM(direction = 'gelen') AS in_count, MAX(happened_at) AS last_at
    FROM touches WHERE person_id = ? GROUP BY channel ORDER BY last_at DESC`, personId);
  return list.map((c) => ({ ...c, awaiting: !!net?.awaiting && net.awaiting.channel === c.channel }));
}

/** Bir firmanın kanal kanal temas özeti: firmaya doğrudan yazılanlar + çalışanlarına yazılanlar */
export function companyChannelSummary(ctx: Ctx, companyId: number): ChannelSummary[] {
  return rows<ChannelSummary>(ctx, `SELECT channel, COUNT(*) AS total, SUM(direction = 'giden') AS out_count, SUM(direction = 'gelen') AS in_count, MAX(happened_at) AS last_at
    FROM touches t WHERE ${COMPANY_TOUCHES} GROUP BY channel ORDER BY last_at DESC`, companyId, companyId);
}

/**
 * Haftalık temas sayıları: `ref` gününün haftası (pazartesiden; varsayılan bugün) ve bir önceki hafta, kanal kırılımıyla.
 * Yeni kayıt sayıları kişi ve firma ayrı. Açık teklif sayıları o anki durumdur, haftaya bağlı değildir.
 */
export function weekStats(ctx: Ctx, ref = ctx.clock.today()): WeekStats {
  const today = ctx.clock.today();
  const ws = weekStart(ref);
  const prev = addDays(ws, -WEEK_DAYS);
  // gelecek günlerin temasları sayılmaz
  const until = addDays(ws, WEEK_DAYS - 1) < today ? addDays(ws, WEEK_DAYS - 1) : today;
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
  // open offers come from the pipeline module (none without it)
  // new people and companies: direct table reads on purpose (tables always exist, the numbers keep working without those modules)
  const newRecords = (table: "people" | "companies", from: string, to: string) =>
    rows<{ created_at: string }>(ctx, `SELECT created_at FROM ${table} WHERE created_at >= ?`, addDays(from, -1))
      .filter((p) => { const d = dayOf(p.created_at); return d >= from && d <= to; }).length;
  const offers = (ctx.mod("pipeline")?.openOfferTimes() ?? []).map((updated_at) => ({ updated_at }));
  const rate = (b: { sent: number; replies: number }) => (b.sent ? b.replies / b.sent : null);
  return {
    week_start: ws,
    this_week: { ...cur, reply_rate: rate(cur), new_people: newRecords("people", ws, until), new_companies: newRecords("companies", ws, until) },
    last_week: { ...last, reply_rate: rate(last), new_people: newRecords("people", prev, addDays(ws, -1)), new_companies: newRecords("companies", prev, addDays(ws, -1)) },
    by_channel: CHANNELS.filter((c) => by.has(c)).map((c) => ({ channel: c, ...by.get(c)! })),
    open_offers: offers.length,
    silent_offers: offers.filter((o) => daysBetween(dayOf(o.updated_at), today) >= SILENT_OFFER_DAYS).length,
  };
}

/** The "Bu hafta" block of the Today view: touches since Monday and the week before, open offers, new people, the channel split */
export function weekToday(ctx: Ctx) {
  const date = ctx.clock.today();
  const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(date, -day);
  const prev = addDays(start, -WEEK_DAYS);
  const at = localDay("happened_at");
  const t = rows<{ sent: number; sent_prev: number; replies: number; meetings: number }>(ctx, `SELECT
      SUM(direction = 'giden' AND ${at} >= ?) AS sent,
      SUM(direction = 'giden' AND ${at} < ?) AS sent_prev,
      SUM(direction = 'gelen' AND ${at} >= ?) AS replies,
      SUM(kind = 'gorusme' AND ${at} >= ?) AS meetings
    FROM touches WHERE ${at} >= ?`, start, start, start, start, prev)[0];
  // open offers come from the pipeline module (none without it); a silent one was last touched three days ago or earlier
  const offerTimes = ctx.mod("pipeline")?.openOfferTimes() ?? [];
  const silentBefore = addDays(date, -SILENT_OFFER_DAYS);
  const w = weekStats(ctx);
  return {
    start, sent: t?.sent ?? 0, sent_prev: t?.sent_prev ?? 0, replies: t?.replies ?? 0, meetings: t?.meetings ?? 0,
    offers: offerTimes.length, offers_silent: offerTimes.filter((t) => dayOf(t) <= silentBefore).length,
    replies_prev: w.last_week.replies, new_people: w.this_week.new_people, by_channel: w.by_channel,
  };
}

/** Bugün ekranının network bölümleri: cevap bekleyenler ve soğuyanlar */
export function networkLists(ctx: Ctx, limit = NETWORK_LIST_LIMIT): NetworkLists {
  const stats = networkStats(ctx);
  const tags = tagsOf(ctx, "person");
  const sectors = sectorsOf(ctx, "person");
  const people = rows(ctx, `SELECT p.id, p.name, p.company_id, p.contact_status, p.next_follow_up_at, p.created_by, c.name AS company_name
    FROM people p LEFT JOIN companies c ON c.id = p.company_id`)
    .map((p) => ({ ...p, ...labelFields(tags.get(p.id), sectors.get(p.id)), ...stats.get(p.id)! }));
  const awaiting = people.filter((p) => p.awaiting).sort((a, b) => b.awaiting!.days - a.awaiting!.days || a.name.localeCompare(b.name, LOCALE));
  const cooling = people.filter((p) => p.cooling).sort((a, b) => b.days_since - a.days_since || a.name.localeCompare(b.name, LOCALE));
  const cut = <T>(l: T[]) => ({ rows: l.slice(0, limit), total: l.length });
  return { awaiting: cut(awaiting), cooling: cut(cooling), settings: networkSettings(ctx) };
}
