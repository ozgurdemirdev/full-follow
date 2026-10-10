import { eq } from "drizzle-orm";
import { FFError, norm, row, rows, type Ctx } from "../context";
import type { Q } from "../db/client";
import { ideas, opportunities } from "../db/schema";
import type { CommentTarget } from "../constants";

export const TARGET_TABLE: Record<CommentTarget, string> = {
  person: "people", company: "companies", opportunity: "opportunities", project: "projects",
  task: "tasks", draft: "drafts", payment: "payments", post: "posts", idea: "ideas", own_project: "own_projects",
};

export const TABLE_LABEL: Record<string, string> = {
  people: "kişi", companies: "firma", opportunities: "fırsat", projects: "proje", tasks: "görev",
  drafts: "taslak", payments: "ödeme", sources: "kaynak", comments: "yorum", touches: "temas",
  sectors: "sektör", notes: "not", posts: "paylaşım", templates: "şablon", ideas: "fikir", own_projects: "kendi projesi", idea_people: "fikir ilgisi", tags: "etiket", links: "link", daily_goals: "hedef",
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

/** Olay için ilgili kayıtları tamamlar: fırsat/projeden kişiyi, projeden fırsatı bulur */
export function link(ctx: Ctx, l: Link): Required<Link> {
  let { person_id = null, opportunity_id = null, project_id = null } = l;
  if (project_id) {
    const p = row(ctx, "SELECT person_id, opportunity_id FROM projects WHERE id = ?", project_id);
    if (p) {
      person_id ??= p.person_id;
      opportunity_id ??= p.opportunity_id;
    }
  }
  if (opportunity_id) {
    const o = row(ctx, "SELECT person_id FROM opportunities WHERE id = ?", opportunity_id);
    if (o) person_id ??= o.person_id;
  }
  return { person_id, opportunity_id, project_id };
}

/** Bir yorum hedefinin olay bağlantıları */
export function targetLink(ctx: Ctx, type: CommentTarget, id: number): Required<Link> {
  switch (type) {
    case "person": return link(ctx, { person_id: id });
    case "opportunity": return link(ctx, { opportunity_id: id });
    case "project": return link(ctx, { project_id: id });
    case "company":
    case "post":
    case "idea":
    case "own_project": return link(ctx, {});
    case "payment": {
      const p = row(ctx, "SELECT project_id FROM payments WHERE id = ?", id);
      return link(ctx, { project_id: p?.project_id });
    }
    case "task":
    case "draft": {
      const r = row(ctx, `SELECT person_id, opportunity_id, project_id FROM ${TARGET_TABLE[type]} WHERE id = ?`, id);
      return link(ctx, r ?? {});
    }
  }
}

export function targetLabel(ctx: Ctx, type: CommentTarget, id: number): string {
  switch (type) {
    case "person": return row(ctx, "SELECT name FROM people WHERE id = ?", id)?.name ?? `#${id}`;
    case "company": return row(ctx, "SELECT name FROM companies WHERE id = ?", id)?.name ?? `#${id}`;
    case "opportunity": return row(ctx, "SELECT title FROM opportunities WHERE id = ?", id)?.title ?? `#${id}`;
    case "project": return row(ctx, "SELECT name FROM projects WHERE id = ?", id)?.name ?? `#${id}`;
    case "task": return row(ctx, "SELECT title FROM tasks WHERE id = ?", id)?.title ?? `#${id}`;
    case "draft": {
      const d = row(ctx, "SELECT p.name FROM drafts d JOIN people p ON p.id = d.person_id WHERE d.id = ?", id);
      return `taslak #${id}${d ? ` (${d.name})` : ""}`;
    }
    case "payment": {
      const p = row(ctx, "SELECT milestone, project_id FROM payments WHERE id = ?", id);
      return p ? `ödeme #${id} (${p.milestone})` : `ödeme #${id}`;
    }
    case "post": return row(ctx, "SELECT title FROM posts WHERE id = ?", id)?.title ?? `#${id}`;
    case "idea": return row(ctx, "SELECT title FROM ideas WHERE id = ?", id)?.title ?? `#${id}`;
    case "own_project": return row(ctx, "SELECT name FROM own_projects WHERE id = ?", id)?.name ?? `#${id}`;
  }
}

export const truncate = (s: string | null | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

// ---- İsimle referans ----

const REF_TABLES = {
  person: { table: "people", col: "name", label: "kişi" },
  company: { table: "companies", col: "name", label: "firma" },
  opportunity: { table: "opportunities", col: "title", label: "fırsat" },
  project: { table: "projects", col: "name", label: "proje" },
  source: { table: "sources", col: "name", label: "kaynak" },
  sector: { table: "sectors", col: "name", label: "sektör" },
  post: { table: "posts", col: "title", label: "paylaşım" },
  idea: { table: "ideas", col: "title", label: "fikir" },
  own_project: { table: "own_projects", col: "name", label: "kendi projesi" },
  template: { table: "templates", col: "name", label: "şablon" },
  tag: { table: "tags", col: "name", label: "etiket" },
  goal: { table: "daily_goals", col: "title", label: "hedef" },
} as const;
export type RefType = keyof typeof REF_TABLES;
export const isRefType = (t: string): t is RefType => t in REF_TABLES;

/** id (12, "12", "#12") ya da isim → id. İsim birden fazla kaydı eşliyorsa 'ambiguous' hatası kısa liste verir. */
export function resolveRef(ctx: Ctx, type: RefType, ref: string | number): number {
  const t = REF_TABLES[type];
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

const INPUT_REFS: Record<string, [string, RefType]> = {
  person: ["person_id", "person"], company: ["company_id", "company"], source: ["source_id", "source"],
  opp: ["opportunity_id", "opportunity"], opportunity: ["opportunity_id", "opportunity"],
  project: ["project_id", "project"], referred_by: ["referred_by_id", "person"],
  goal: ["goal_id", "goal"], post: ["post_id", "post"], idea: ["idea_id", "idea"], parent: ["parent_id", "idea"], own_project: ["own_project_id", "own_project"], template: ["template_id", "template"],
};

/** Girdideki isim alanlarını (person, company, source, opp, project, referred_by, post, idea, template) *_id'ye çevirir */
export function resolveInput<T extends Record<string, any>>(ctx: Ctx, data: T): Record<string, any> {
  const out: Record<string, any> = { ...data };
  for (const [key, [idKey, type]] of Object.entries(INPUT_REFS)) {
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
