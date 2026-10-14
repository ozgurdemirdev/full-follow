import { eq } from "drizzle-orm";
import { FFError, norm, row, rows, type Ctx } from "../context";
import type { Q } from "../db/client";
import { ideas, opportunities } from "../db/schema";
import { MODULE_TYPE_OWNER, type CommentTarget } from "../constants";
import type { EntityRef } from "../modules/types";

/** Tables of the comment targets core owns; the modules' targets come from the registry (`targetTable`) */
export const TARGET_TABLE: Record<string, string> = { idea: "ideas", own_project: "own_projects" };

/** Table of a comment target type: core's, else the installed module's; undefined for an unknown type or one whose module is not installed */
export const targetTable = (ctx: Ctx, type: string): string | undefined => TARGET_TABLE[type] ?? ctx.types.commentTarget(type)?.table;

/** The row a file, link or comment hangs on: its table comes from the registry, so a record type whose module is not installed is a clear error */
export function requireTarget(ctx: Ctx, type: string, id: number) {
  const table = targetTable(ctx, type);
  if (!table) {
    const owner = (MODULE_TYPE_OWNER as Record<string, string>)[type];
    throw new FFError("validation", owner ? `"${type}" türü için "${owner}" modülü kurulu değil` : `bilinmeyen kayıt türü "${type}"`);
  }
  return requireRow(ctx, table, id);
}

export const TABLE_LABEL: Record<string, string> = {
  people: "kişi", companies: "firma", opportunities: "fırsat", projects: "proje", tasks: "görev",
  drafts: "taslak", payments: "ödeme", sources: "kaynak", comments: "yorum", touches: "temas",
  sectors: "sektör", notes: "not", posts: "paylaşım", templates: "şablon", ideas: "fikir", own_projects: "kendi projesi", idea_people: "fikir ilgisi", tags: "etiket", links: "link", daily_goals: "hedef", files: "dosya", offers: "teklif", opportunity_people: "ekip üyesi",
};

export function requireRow<T = any>(ctx: Ctx, table: string, id: number, what = TABLE_LABEL[table] ?? table): T {
  const r = row<T>(ctx, `SELECT * FROM ${table} WHERE id = ?`, id);
  if (!r) throw new FFError("not_found", `${what} #${id} bulunamadı`);
  return r;
}

export interface Link {
  person_id?: number | null;
  opportunity_id?: number | null;
  project_id?: number | null;
}

/** Olay için ilgili kayıtları tamamlar: fırsat/projeden kişiyi, projeden fırsatı bulur (without the pipeline and projects modules it keeps what it was given) */
export function link(ctx: Ctx, l: Link): Required<Link> {
  let { person_id = null, opportunity_id = null, project_id = null } = l;
  if (project_id) {
    const p = ctx.mod("projects")?.projects.ref(project_id);
    if (p) {
      person_id ??= p.person_id;
      opportunity_id ??= p.opportunity_id;
    }
  }
  if (opportunity_id) {
    const o = ctx.mod("pipeline")?.opportunities.ref(opportunity_id);
    if (o) person_id ??= o.person_id;
  }
  return { person_id, opportunity_id, project_id };
}

/** Bir yorum hedefinin olay bağlantıları (modül hedefleri kendi bağlantısını verir) */
export function targetLink(ctx: Ctx, type: CommentTarget, id: number): Required<Link> {
  switch (type) {
    case "idea":
    case "own_project": return link(ctx, {});
    default: return link(ctx, ctx.types.commentTarget(type)?.link?.(ctx, id) ?? {});
  }
}

export function targetLabel(ctx: Ctx, type: CommentTarget, id: number): string {
  switch (type) {
    case "idea": return row(ctx, "SELECT title FROM ideas WHERE id = ?", id)?.title ?? `#${id}`;
    case "own_project": return row(ctx, "SELECT name FROM own_projects WHERE id = ?", id)?.name ?? `#${id}`;
    default: return ctx.types.commentTarget(type)?.label(ctx, id) ?? `#${id}`;
  }
}

export const truncate = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

// ---- İsimle referans ----

const CORE_REFS = {
  source: { table: "sources", col: "name", label: "kaynak" },
  sector: { table: "sectors", col: "name", label: "sektör" },
  idea: { table: "ideas", col: "title", label: "fikir" },
  own_project: { table: "own_projects", col: "name", label: "kendi projesi" },
  tag: { table: "tags", col: "name", label: "etiket" },
} as const;
export type RefType = keyof typeof CORE_REFS;

/** Table and name column of a type that can be given by name: core types here, module types from the registry */
const refOf = (ctx: Ctx, type: string): EntityRef | undefined => (CORE_REFS as Record<string, EntityRef>)[type] ?? ctx.types.ref(type);
export const isRefType = (ctx: Ctx, t: string): boolean => !!refOf(ctx, t);

/** id (12, "12", "#12") ya da isim → id. İsim birden fazla kaydı eşliyorsa 'ambiguous' hatası kısa liste verir. */
export function resolveRef(ctx: Ctx, type: string, ref: string | number): number {
  const t = refOf(ctx, type);
  if (!t) {
    const owner = (MODULE_TYPE_OWNER as Record<string, string>)[type];
    throw new FFError("validation", owner ? `"${type}" türü için "${owner}" modülü kurulu değil` : `${type} isimle verilemez`);
  }
  const s = String(ref).trim();
  const m = /^#?(\d+)$/.exec(s);
  if (m) {
    requireRow(ctx, t.table, Number(m[1]), t.label);
    return Number(m[1]);
  }
  const needle = norm(s);
  if (!needle) throw new FFError("validation", `${t.label} adı boş`);
  const all = rows<{ id: number; n: string }>(ctx, `SELECT id, ${t.col} AS n FROM ${t.table}`);
  const exact = all.filter((r) => norm(r.n) === needle);
  const hits = exact.length ? exact : all.filter((r) => norm(r.n).includes(needle));
  if (hits.length === 1) return hits[0].id;
  if (hits.length === 0) throw new FFError("not_found", `${t.label} "${s}" bulunamadı`);
  const cand = hits.slice(0, 8).map((h) => ({ id: h.id, label: h.n }));
  throw new FFError("ambiguous", `"${s}" birden fazla ${t.label} ile eşleşiyor: ${cand.map((c) => `#${c.id} ${c.label}`).join(", ")}`, cand);
}

const CORE_INPUT_REFS: Record<string, [string, string]> = {
  source: ["source_id", "source"],
  idea: ["idea_id", "idea"], parent: ["parent_id", "idea"], own_project: ["own_project_id", "own_project"],
};

/** Girdideki isim alanlarını (source, idea ve kurulu modüllerin türleri: person, company, post, opportunity, opp, project, referred_by...) *_id'ye çevirir */
export function resolveInput<T extends Record<string, any>>(ctx: Ctx, data: T): Record<string, any> {
  const out: Record<string, any> = { ...data };
  const moduleRefs = ctx.types.inputRefs().map(([key, idKey, type]): [string, [string, string]] => [key, [idKey, type]]);
  for (const [key, [idKey, type]] of [...Object.entries(CORE_INPUT_REFS), ...moduleRefs]) {
    if (out[key] === undefined) continue;
    const v = out[key];
    delete out[key];
    if (out[idKey] === undefined) out[idKey] = v === null || v === "" ? null : resolveRef(ctx, type, v);
  }
  return out;
}

// ---- Sıralı gruplar (kanban sütunu, öncelik grubu) ----

const GROUP_TABLES = { opportunities, ideas } as const;

/** `id`'yi `where` ile seçilen grupta `position`'a (varsayılan: sona) koyar, grubu 0..n yeniden numaralar */
export function placeInGroup(q: Q, ctx: Ctx, table: keyof typeof GROUP_TABLES, where: string, args: unknown[], id: number, position?: number) {
  const ids = rows<{ id: number }>(ctx, `SELECT id FROM ${table} WHERE ${where} AND id != ? ORDER BY position, id`, ...args, id).map((r) => r.id);
  ids.splice(Math.min(position ?? ids.length, ids.length), 0, id);
  const t = GROUP_TABLES[table];
  ids.forEach((x, i) => q.update(t).set({ position: i }).where(eq(t.id, x)).run());
}

/** Gruptan çıkan kaydın bıraktığı boşluğu kapatır (grubu 0..n yeniden numaralar) */
export function renumberGroup(q: Q, ctx: Ctx, table: keyof typeof GROUP_TABLES, where: string, args: unknown[]) {
  const t = GROUP_TABLES[table];
  rows<{ id: number }>(ctx, `SELECT id FROM ${table} WHERE ${where} ORDER BY position, id`, ...args)
    .forEach((r, i) => q.update(t).set({ position: i }).where(eq(t.id, r.id)).run());
}
