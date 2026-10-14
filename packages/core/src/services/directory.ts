// List helpers shared by the people and companies modules (labels, filters) and the tag list
import { norm, page, rows, type Ctx, type ListOpts } from "../context";
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
export function labelFilter<T extends { tag_ids: number[]; sectors: { id: number }[]; source_id: number | null; contact_status: string }>(ctx: Ctx, list: T[], f: Record<string, any>): T[] {
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

/** Etiket listesi: kişi ve firma sayısıyla; silinenler sadece `all` ile (kayıtlarda görünmeye devam ettikleri için) */
export function tagsList(ctx: Ctx, o: ListOpts): Rows {
  const f = o.filter ?? {};
  const list = rows(ctx, `SELECT t.*, (SELECT COUNT(*) FROM person_tags x WHERE x.tag_id = t.id) AS people_count,
      (SELECT COUNT(*) FROM company_tags x WHERE x.tag_id = t.id) AS company_count
    FROM tags t ORDER BY t.name COLLATE NOCASE`)
    .filter((t) => (bool(f.all) || !t.deleted_at) && has(o.q, t.name, t.slug));
  return page(list, o.limit, o.offset);
}
