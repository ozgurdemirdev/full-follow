import {
  bool, dayOf, daysBetween, has, idsOf, inIds, labelFields, labelFilter, page, RHYTHM_WEEKS, rows, sectorsOf, stripKeys, tagsOf,
  type Ctx, type ListOpts, type PersonNet, type PersonRow,
} from "@fullfollow/core";

/** The touch state of a person without the network module: nothing was ever touched */
function noTouches(ctx: Ctx, p: { created_at: string }): PersonNet {
  return {
    last_touch_at: null, last_channel: null, last_direction: null, last_summary: null, last_in_at: null,
    days_since: Math.max(0, daysBetween(dayOf(p.created_at), ctx.clock.today())), awaiting: null, cooling: false,
  };
}

/**
 * Kişi listesi: etiket, sektör, kaynak, kişi/firma/paylaşım adı ve temas durumuyla (temas durumu network modülünden; yoksa boş).
 * Filtreler: ids, tag, sector, source, status, awaiting, cooling, channel, company_id, referred_by_id, post_id, follow_up_due.
 * `ids`, `company_id`, `referred_by_id` and `post_id` narrow in SQL, and then the touch state, tags and sectors are read only for those people.
 */
export function peopleList(ctx: Ctx, o: ListOpts): { rows: PersonRow[]; total: number } {
  const f = o.filter ?? {};
  const network = ctx.mod("network");
  const where: string[] = [];
  const args: unknown[] = [];
  const ids = idsOf(f);
  if (ids) { where.push(inIds("p.id")); args.push(JSON.stringify(ids)); }
  for (const k of ["company_id", "referred_by_id", "post_id"] as const) if (f[k]) { where.push(`p.${k} = ?`); args.push(Number(f[k])); }
  const base = rows(ctx, `
    SELECT p.*, c.name AS company_name, r.name AS referred_by_name, so.name AS source_name, po.title AS post_title,
      (SELECT COUNT(*) FROM people k WHERE k.referred_by_id = p.id) AS referral_count
    FROM people p LEFT JOIN companies c ON c.id = p.company_id LEFT JOIN people r ON r.id = p.referred_by_id
    LEFT JOIN sources so ON so.id = p.source_id LEFT JOIN posts po ON po.id = p.post_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY (p.next_follow_up_at IS NULL), p.next_follow_up_at, p.name`, ...args);
  const owners = where.length ? base.map((p) => p.id as number) : undefined;
  const net = network?.stats(owners);
  const rhythm = network?.rhythm(owners);
  const tags = tagsOf(ctx, "person", owners);
  const sectors = sectorsOf(ctx, "person", owners);
  let list: PersonRow[] = base
    .map((p) => {
      const n = net?.get(p.id) ?? noTouches(ctx, p);
      return {
        ...stripKeys(p), ...labelFields(tags.get(p.id), sectors.get(p.id)),
        last_touch_at: n.last_touch_at, last_channel: n.last_channel, last_direction: n.last_direction, last_summary: n.last_summary,
        days_since: n.days_since, awaiting: n.awaiting, cooling: n.cooling,
        rhythm: rhythm?.get(p.id) ?? new Array<number>(RHYTHM_WEEKS).fill(0),
      };
    });
  list = labelFilter(ctx, list, f);
  if (bool(f.awaiting)) list = list.filter((p) => p.awaiting).sort((a, b) => b.awaiting!.days - a.awaiting!.days);
  if (bool(f.cooling)) list = list.filter((p) => p.cooling).sort((a, b) => b.days_since - a.days_since);
  if (f.channel) {
    const ids = new Set(rows<{ person_id: number }>(ctx, "SELECT DISTINCT person_id FROM touches WHERE channel = ? AND person_id IS NOT NULL", f.channel).map((r) => r.person_id));
    list = list.filter((p) => ids.has(p.id));
  }
  if (bool(f.follow_up_due)) list = list.filter((p) => p.next_follow_up_at && p.next_follow_up_at <= ctx.clock.today());
  list = list.filter((p) => has(o.q, p.name, p.role, p.email, p.handle, p.phone, p.company_name, p.instagram, p.linkedin, p.sector_path, p.tags.join(" ")));
  return page(list, o.limit, o.offset);
}
