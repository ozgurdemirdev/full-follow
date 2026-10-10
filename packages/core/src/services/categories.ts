// Kategoriler: etiket, kaynak (nereden buldum) ve kişi/firma bağları (etiket, sektör).
// Silinen kategori yerinde gizlenir: zaten taşıyan kayıtlarda kalır, yeni kayda seçilemez.
import { eq } from "drizzle-orm";
import { emit, FFError, norm, parse, row, rows, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { company_sectors, company_tags, person_sectors, person_tags, sources, tags } from "../db/schema";
import { sourceCreate, sourceUpdate, tagCreate, tagUpdate } from "../schemas";
import { duplicate } from "./dupes";
import { ensureSector } from "./sectors";
import { requireRow } from "./shared";
import { restoreCategory, softDelete } from "./trash";

export type Owner = "person" | "company";
const TAG_TABLE = { person: person_tags, company: company_tags } as const;
const SECTOR_TABLE = { person: person_sectors, company: company_sectors } as const;
const OWNER_COL = { person: "person_id", company: "company_id" } as const;
const TAG_SQL = { person: "person_tags", company: "company_tags" } as const;
const SECTOR_SQL = { person: "person_sectors", company: "company_sectors" } as const;

const slugify = (s: string) => norm(s).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "etiket";

/** Aynı adlı (büyük/küçük harf ve Türkçe karakter duyarsız) kategori; silinmiş olanlar da bakılır */
function sameName(ctx: Ctx, table: "tags" | "sources", name: string, selfId?: number) {
  return rows<{ id: number; name: string; deleted_at: string | null }>(ctx, `SELECT id, name, deleted_at FROM ${table}`)
    .find((x) => x.id !== selfId && norm(x.name) === norm(name));
}

function assertFreeName(ctx: Ctx, table: "tags" | "sources", name: string, selfId?: number) {
  const hit = sameName(ctx, table, name, selfId);
  if (hit) throw duplicate({ type: table === "tags" ? "tag" : "source", id: hit.id, label: hit.name, field: "ad", in_trash: !!hit.deleted_at });
}

// ---------------------------------------------------------------- etiketler
export function tagsService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(tagCreate, input);
    return ctx.db.transaction((tx) => ({ row: insertTag(tx, ctx, d.name, d.color), effects: [] as string[] }));
  }
  /** Ad ve renk değişir, slug (soğuma kuralının baktığı kısa ad) değişmez */
  function update(id: number, input: unknown) {
    const d = parse(tagUpdate, input);
    requireRow(ctx, "tags", id, "etiket");
    if (d.name) assertFreeName(ctx, "tags", d.name, id);
    if (Object.keys(d).length) ctx.db.update(tags).set({ ...d, updated_at: ctx.clock.now() }).where(eq(tags.id, id)).run();
    return { row: requireRow(ctx, "tags", id, "etiket"), effects: [] as string[] };
  }
  return {
    create, update,
    remove: (id: number) => softDelete(ctx, "tag", id),
    restore: (id: number) => restoreCategory(ctx, "tag", id),
  };
}

function insertTag(q: Q, ctx: Ctx, name: string, color?: string) {
  assertFreeName(ctx, "tags", name);
  let slug = slugify(name);
  for (let i = 2; row(ctx, "SELECT 1 x FROM tags WHERE slug = ?", slug); i++) slug = `${slugify(name)}_${i}`;
  const r = q.insert(tags).values({ name, slug, color: (color ?? "aday") as any, ...stamp(ctx) }).returning().get();
  emit(q, ctx, { type: "tag.created", summary: `Etiket eklendi: ${name}` });
  return r;
}

/** "Sıcak", "sicak", 7 ya da "#7" → etiket id; yoksa açılır (MCP ve hızlı giriş için) */
export function resolveTagIds(q: Q, ctx: Ctx, list: readonly (string | number)[]): number[] {
  const all = rows<{ id: number; name: string; slug: string; deleted_at: string | null }>(ctx, "SELECT id, name, slug, deleted_at FROM tags");
  const out: number[] = [];
  for (const ref of list) {
    const s = String(ref).trim();
    if (!s) continue;
    const m = /^#?(\d+)$/.exec(s);
    if (m) {
      out.push(requireRow(ctx, "tags", Number(m[1]), "etiket").id);
      continue;
    }
    const hits = all.filter((t) => t.slug === s || norm(t.name) === norm(s));
    const hit = hits.find((t) => !t.deleted_at) ?? hits[0];
    if (hit) out.push(hit.id);
    else {
      const r = insertTag(q, ctx, s);
      all.push({ ...r, deleted_at: null });
      out.push(r.id);
    }
  }
  return [...new Set(out)];
}

/** Silinmiş kategori yeni kayda eklenemez; zaten taşıyan kayıtta kalabilir */
function assertPickable(ctx: Ctx, table: "tags" | "sectors" | "sources", ids: number[], current: number[]) {
  const fresh = ids.filter((id) => !current.includes(id));
  if (!fresh.length) return;
  const dead = rows<{ name: string }>(ctx, `SELECT name FROM ${table} WHERE deleted_at IS NOT NULL AND id IN (${fresh.map(() => "?").join(",")})`, ...fresh);
  if (dead.length) {
    const what = { tags: "etiket", sectors: "sektör", sources: "kaynak" }[table];
    throw new FFError("rule", `${dead.map((d) => d.name).join(", ")} ${what}i silinmiş; Ayarlar > Çöp kutusundan geri yükleyince seçilebilir`);
  }
}

const currentTags = (ctx: Ctx, owner: Owner, id: number) =>
  rows<{ tag_id: number }>(ctx, `SELECT tag_id FROM ${TAG_SQL[owner]} WHERE ${OWNER_COL[owner]} = ?`, id).map((r) => r.tag_id);

/** Etiket bağları: set tümünü değiştirir, add/remove ekler/çıkarır. Değişiklik olduysa true. */
export function assignTags(q: Q, ctx: Ctx, owner: Owner, id: number, o: { set?: readonly (string | number)[]; add?: readonly (string | number)[]; remove?: readonly (string | number)[] }): boolean {
  if (!o.set && !o.add?.length && !o.remove?.length) return false;
  const cur = currentTags(ctx, owner, id);
  let next = o.set ? resolveTagIds(q, ctx, o.set) : [...cur];
  if (o.add?.length) next = [...new Set([...next, ...resolveTagIds(q, ctx, o.add)])];
  if (o.remove?.length) {
    const drop = new Set(resolveTagIds(q, ctx, o.remove));
    next = next.filter((t) => !drop.has(t));
  }
  assertPickable(ctx, "tags", next, cur);
  const add = next.filter((t) => !cur.includes(t));
  const del = cur.filter((t) => !next.includes(t));
  const table = TAG_SQL[owner];
  const col = OWNER_COL[owner];
  for (const t of del) ctx.sqlite.prepare(`DELETE FROM ${table} WHERE ${col} = ? AND tag_id = ?`).run(id, t);
  for (const t of add) q.insert(TAG_TABLE[owner]).values({ [col]: id, tag_id: t, created_at: ctx.clock.now(), created_by: ctx.actor } as any).run();
  return add.length + del.length > 0;
}

/** Kural etiketi (kazanılınca "müşteri"): slug'la eklenir; etiket silinmişse eklenmez */
export function addTagBySlug(q: Q, ctx: Ctx, owner: Owner, id: number, slug: string): boolean {
  const t = row<{ id: number }>(ctx, "SELECT id FROM tags WHERE slug = ? AND deleted_at IS NULL", slug);
  if (!t) return false;
  const r = ctx.sqlite.prepare(`INSERT OR IGNORE INTO ${TAG_SQL[owner]} (${OWNER_COL[owner]}, tag_id, created_at, created_by) VALUES (?, ?, ?, ?)`)
    .run(id, t.id, ctx.clock.now(), ctx.actor);
  return r.changes > 0;
}

/** Sektör bağları: ["Sağlık > Diş hekimi", 4] gibi liste tümünü değiştirir; eksik sektörler açılır */
export function assignSectors(q: Q, ctx: Ctx, owner: Owner, id: number, list: readonly (string | number)[] | undefined): boolean {
  if (!list) return false;
  const cur = rows<{ sector_id: number }>(ctx, `SELECT sector_id FROM ${SECTOR_SQL[owner]} WHERE ${OWNER_COL[owner]} = ?`, id).map((r) => r.sector_id);
  const next = [...new Set(list.map((s) => ensureSector(q, ctx, typeof s === "number" ? s : String(s).trim())).filter((x): x is number => !!x))];
  assertPickable(ctx, "sectors", next, cur);
  const add = next.filter((s) => !cur.includes(s));
  const del = cur.filter((s) => !next.includes(s));
  for (const s of del) ctx.sqlite.prepare(`DELETE FROM ${SECTOR_SQL[owner]} WHERE ${OWNER_COL[owner]} = ? AND sector_id = ?`).run(id, s);
  for (const s of add) q.insert(SECTOR_TABLE[owner]).values({ [OWNER_COL[owner]]: id, sector_id: s, created_at: ctx.clock.now(), created_by: ctx.actor } as any).run();
  return add.length + del.length > 0;
}

/** Kaynak (nereden buldum) seçimi: silinmiş kaynak sadece zaten taşıyan kayıtta kalabilir */
export function checkSource(ctx: Ctx, sourceId: number | null | undefined, current: number | null = null) {
  if (!sourceId) return;
  requireRow(ctx, "sources", sourceId, "kaynak");
  assertPickable(ctx, "sources", [sourceId], current ? [current] : []);
}

/** "LinkedIn" ya da id → kaynak id; yoksa açılır */
export function ensureSource(q: Q, ctx: Ctx, ref: string | number | null): number | null {
  if (ref === null || ref === "") return null;
  const s = String(ref).trim();
  const m = /^#?(\d+)$/.exec(s);
  if (m) return requireRow(ctx, "sources", Number(m[1]), "kaynak").id;
  const hit = sameName(ctx, "sources", s);
  if (hit) return hit.id;
  const r = q.insert(sources).values({ name: s, kind: "diger", ...stamp(ctx) }).returning().get();
  emit(q, ctx, { type: "source.created", summary: `Kaynak eklendi: ${s}` });
  return r.id;
}

/** Kayıt başına etiketler ve sektörler (listeler tek sorguda alır) */
export function tagsOf(ctx: Ctx, owner: Owner) {
  const out = new Map<number, { id: number; name: string; slug: string; color: string; deleted: boolean }[]>();
  for (const r of rows(ctx, `SELECT x.${OWNER_COL[owner]} AS owner, t.id, t.name, t.slug, t.color, t.deleted_at FROM ${TAG_SQL[owner]} x
    JOIN tags t ON t.id = x.tag_id ORDER BY t.name COLLATE NOCASE`)) {
    const list = out.get(r.owner) ?? [];
    list.push({ id: r.id, name: r.name, slug: r.slug, color: r.color, deleted: !!r.deleted_at });
    out.set(r.owner, list);
  }
  return out;
}

export function sectorsOf(ctx: Ctx, owner: Owner) {
  const out = new Map<number, { id: number; parent_id: number | null; path: string }[]>();
  for (const r of rows(ctx, `SELECT x.${OWNER_COL[owner]} AS owner, s.id, s.parent_id, s.name, p.name AS parent_name FROM ${SECTOR_SQL[owner]} x
    JOIN sectors s ON s.id = x.sector_id LEFT JOIN sectors p ON p.id = s.parent_id ORDER BY COALESCE(p.name, s.name), s.name`)) {
    const list = out.get(r.owner) ?? [];
    list.push({ id: r.id, parent_id: r.parent_id, path: r.parent_name ? `${r.parent_name} > ${r.name}` : r.name });
    out.set(r.owner, list);
  }
  return out;
}

// ---------------------------------------------------------------- kaynaklar
export function sourcesService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(sourceCreate, input);
    assertFreeName(ctx, "sources", d.name);
    const r = ctx.db.insert(sources).values({ ...d, ...stamp(ctx) }).returning().get();
    return { row: r, effects: [] as string[] };
  }
  function update(id: number, input: unknown) {
    const d = parse(sourceUpdate, input);
    requireRow(ctx, "sources", id, "kaynak");
    if (d.name) assertFreeName(ctx, "sources", d.name, id);
    if (Object.keys(d).length) ctx.db.update(sources).set({ ...d, updated_at: ctx.clock.now() }).where(eq(sources.id, id)).run();
    return { row: requireRow(ctx, "sources", id, "kaynak"), effects: [] as string[] };
  }
  return {
    create, update,
    remove: (id: number) => softDelete(ctx, "source", id),
    restore: (id: number) => restoreCategory(ctx, "source", id),
  };
}
