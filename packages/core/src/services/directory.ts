// Kişi ve firma listeleri, filtreleri ve kartları (queries.ts'ten ayrıldı)
import { FFError, norm, page, row, rows, type Ctx, type ListOpts } from "../context";
import { sectorsOf, tagsOf } from "./categories";
import { labelFields, networkStats } from "./network";
import { sectorIds } from "./sectors";

type Rows = { rows: any[]; total: number };

export const has = (q: string | undefined, ...fields: (string | null | undefined)[]) => {
  if (!q) return true;
  const n = norm(q);
  return fields.some((f) => norm(f).includes(n));
};
export const bool = (v: unknown) => v === true || v === "true" || v === 1 || v === "1";

/** Mükerrer anahtarları dışarı verilmez (ekranda ve MCP çıktısında gereksiz) */
const KEY_COLS = ["email_key", "domain_key", "name_key", "instagram_key", "linkedin_key"];
export const stripKeys = <T extends Record<string, any>>(r: T): T => {
  const out: Record<string, any> = { ...r };
  for (const k of KEY_COLS) delete out[k];
  return out as T;
};

/** Filtre değeri (id, slug ya da ad; virgülle birden fazla) → id kümesi; eşleşme yoksa boş küme */
function idsFor(ctx: Ctx, table: "tags" | "sectors" | "sources", value: unknown): Set<number> {
  const all = rows<{ id: number; name: string; slug?: string }>(ctx, `SELECT * FROM ${table}`);
  const out = new Set<number>();
  for (const v of String(value).split(",").map((x) => x.trim()).filter(Boolean)) {
    const hits = /^\d+$/.test(v) ? all.filter((x) => x.id === Number(v)) : all.filter((x) => x.slug === v || norm(x.name) === norm(v));
    // ana sektör filtresi alt sektörleri de kapsar
    for (const h of hits) for (const id of table === "sectors" ? sectorIds(ctx, h.id) : [h.id]) out.add(id);
  }
  return out;
}

/** Kişi ve firma listelerinde ortak filtreler: etiket, sektör, kaynak (nereden), temas durumu */
function labelFilter<T extends { tag_ids: number[]; sectors: { id: number }[]; source_id: number | null; contact_status: string }>(ctx: Ctx, list: T[], f: Record<string, any>): T[] {
  if (f.tag) {
    const ids = idsFor(ctx, "tags", f.tag);
    list = list.filter((x) => x.tag_ids.some((t) => ids.has(t)));
  }
  if (f.sector) {
    const ids = idsFor(ctx, "sectors", f.sector);
    list = list.filter((x) => x.sectors.some((s) => ids.has(s.id)));
  }
  if (f.source) {
    const ids = idsFor(ctx, "sources", f.source);
    list = list.filter((x) => x.source_id !== null && ids.has(x.source_id));
  }
  if (f.status) {
    const st = new Set(String(f.status).split(","));
    list = list.filter((x) => st.has(x.contact_status));
  }
  return list;
}

export function peopleList(ctx: Ctx, o: ListOpts): Rows {
  const f = o.filter ?? {};
  const net = networkStats(ctx);
  const tags = tagsOf(ctx, "person");
  const sectors = sectorsOf(ctx, "person");
  let list = rows(ctx, `
    SELECT p.*, c.name AS company_name, r.name AS referred_by_name, so.name AS source_name, po.title AS post_title,
      (SELECT COUNT(*) FROM people k WHERE k.referred_by_id = p.id) AS referral_count
    FROM people p LEFT JOIN companies c ON c.id = p.company_id LEFT JOIN people r ON r.id = p.referred_by_id
    LEFT JOIN sources so ON so.id = p.source_id LEFT JOIN posts po ON po.id = p.post_id
    ORDER BY (p.next_follow_up_at IS NULL), p.next_follow_up_at, p.name`)
    .map((p) => {
      const n = net.get(p.id)!;
      return {
        ...stripKeys(p), ...labelFields(tags.get(p.id), sectors.get(p.id)),
        last_touch_at: n.last_touch_at, last_channel: n.last_channel, last_direction: n.last_direction,
        days_since: n.days_since, awaiting: n.awaiting, cooling: n.cooling,
      };
    });
  list = labelFilter(ctx, list, f);
  if (bool(f.awaiting)) list = list.filter((p) => p.awaiting).sort((a, b) => b.awaiting!.days - a.awaiting!.days);
  if (bool(f.cooling)) list = list.filter((p) => p.cooling).sort((a, b) => b.days_since - a.days_since);
  if (f.channel) {
    const ids = new Set(rows<{ person_id: number }>(ctx, "SELECT DISTINCT person_id FROM touches WHERE channel = ? AND person_id IS NOT NULL", f.channel).map((r) => r.person_id));
    list = list.filter((p) => ids.has(p.id));
  }
  for (const k of ["company_id", "referred_by_id", "post_id"]) if (f[k]) list = list.filter((p) => p[k] === Number(f[k]));
  if (bool(f.follow_up_due)) list = list.filter((p) => p.next_follow_up_at && p.next_follow_up_at <= ctx.clock.today());
  list = list.filter((p) => has(o.q, p.name, p.role, p.email, p.handle, p.phone, p.company_name, p.instagram, p.linkedin, p.sector_path, p.tags.join(" ")));
  return page(list, o.limit, o.offset);
}

/** Firma listesi: kişi sayısı, son temas (firmaya ya da çalışanlarına), açık fırsat sayısı */
export function companiesList(ctx: Ctx, o: ListOpts): Rows {
  const f = o.filter ?? {};
  const tags = tagsOf(ctx, "company");
  const sectors = sectorsOf(ctx, "company");
  let list = rows(ctx, `
    SELECT c.*, so.name AS source_name,
      (SELECT COUNT(*) FROM people p WHERE p.company_id = c.id) AS people_count,
      (SELECT MAX(t.happened_at) FROM touches t WHERE t.company_id = c.id OR t.person_id IN (SELECT id FROM people WHERE company_id = c.id)) AS last_touch_at,
      (SELECT COUNT(*) FROM touches t WHERE t.company_id = c.id OR t.person_id IN (SELECT id FROM people WHERE company_id = c.id)) AS touch_count,
      (SELECT COUNT(*) FROM opportunities x JOIN people p ON p.id = x.person_id WHERE p.company_id = c.id AND x.stage IN ('bulundu','temas','cevap','gorusme','teklif')) AS open_opps
    FROM companies c LEFT JOIN sources so ON so.id = c.source_id ORDER BY c.name COLLATE NOCASE`)
    .map((c) => ({ ...stripKeys(c), ...labelFields(tags.get(c.id), sectors.get(c.id)) }));
  list = labelFilter(ctx, list, f);
  list = list.filter((c) => has(o.q, c.name, c.website, c.email, c.instagram, c.linkedin, c.sector_path, c.tags.join(" ")));
  return page(list, o.limit, o.offset);
}

/** Bir firmanın temasları: firmaya doğrudan yazılanlar + çalışanlarına yazılanlar */
export const COMPANY_TOUCHES = "(t.company_id = ? OR t.person_id IN (SELECT id FROM people WHERE company_id = ?))";

/** Etiket listesi: kişi ve firma sayısıyla; silinenler sadece `all` ile (kayıtlarda görünmeye devam ettikleri için) */
export function tagsList(ctx: Ctx, o: ListOpts): Rows {
  const f = o.filter ?? {};
  const list = rows(ctx, `SELECT t.*, (SELECT COUNT(*) FROM person_tags x WHERE x.tag_id = t.id) AS people_count,
      (SELECT COUNT(*) FROM company_tags x WHERE x.tag_id = t.id) AS company_count
    FROM tags t ORDER BY t.name COLLATE NOCASE`)
    .filter((t) => (bool(f.all) || !t.deleted_at) && has(o.q, t.name, t.slug));
  return page(list, o.limit, o.offset);
}

export function companyCard(ctx: Ctx, id: number, lists: { people: (o: ListOpts) => Rows; touches: (o: ListOpts) => Rows; opportunities: (o: ListOpts) => Rows; drafts: (o: ListOpts) => Rows }) {
  const company = companiesList(ctx, { limit: 100000 }).rows.find((c) => c.id === id);
  if (!company) throw new FFError("not_found", `firma #${id} bulunamadı`);
  const people = lists.people({ filter: { company_id: id }, limit: 500 }).rows;
  const ids = new Set(people.map((p) => p.id));
  return {
    row: company,
    people,
    touches: lists.touches({ filter: { company_scope: id }, limit: 200 }),
    opportunities: lists.opportunities({ limit: 100000 }).rows.filter((x) => ids.has(x.person_id)),
    drafts: lists.drafts({ filter: { company_scope: id, status: "bekliyor" }, limit: 50 }).rows,
    channels: rows(ctx, `SELECT channel, COUNT(*) AS total, SUM(direction = 'giden') AS out_count, SUM(direction = 'gelen') AS in_count, MAX(happened_at) AS last_at
      FROM touches t WHERE ${COMPANY_TOUCHES} GROUP BY channel ORDER BY last_at DESC`, id, id),
    source: company.source_id ? row(ctx, "SELECT id, name FROM sources WHERE id = ?", company.source_id) ?? null : null,
  };
}
