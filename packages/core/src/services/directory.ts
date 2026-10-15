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

/** SQL for "`col` is one of these ids": the ids travel as one JSON text bound to the `?`, so one statement serves any number of them */
export const inIds = (col: string) => `${col} IN (SELECT value FROM json_each(?))`;

/** The ids a list filter narrows to (`ids`: an array or a comma separated text); undefined when the filter does not narrow by id */
export function idsOf(f: Record<string, any>): number[] | undefined {
  const v = f.ids;
  if (v === undefined || v === null || v === "") return undefined;
  return (Array.isArray(v) ? v : String(v).split(",")).map(Number).filter(Number.isInteger);
}

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
  const ids = idsOf(f);
  const list = rows(ctx, `SELECT t.*, (SELECT COUNT(*) FROM person_tags x WHERE x.tag_id = t.id) AS people_count,
      (SELECT COUNT(*) FROM company_tags x WHERE x.tag_id = t.id) AS company_count
    FROM tags t ${ids ? `WHERE ${inIds("t.id")}` : ""} ORDER BY t.name COLLATE NOCASE`, ...(ids ? [JSON.stringify(ids)] : []))
    .filter((t) => (bool(f.all) || !t.deleted_at) && has(o.q, t.name, t.slug));
  return page(list, o.limit, o.offset);
}
