import { and, eq } from "drizzle-orm";
import { emit, FFError, parse, row, stamp, type Ctx } from "../context";
import { comments, companies, people, sources } from "../db/schema";
import { companyCreate, companyUpdate, sourceCreate, sourceUpdate } from "../schemas";
import { requireRow } from "./shared";

export function companiesService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(companyCreate, input);
    return ctx.db.transaction((tx) => {
      const r = tx.insert(companies).values({ ...d, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "company.created", summary: `Firma eklendi: ${r.name}` });
      return { row: r, effects: [] as string[] };
    });
  }
  function update(id: number, input: unknown) {
    const d = parse(companyUpdate, input);
    requireRow(ctx, "companies", id);
    if (Object.keys(d).length) ctx.db.update(companies).set({ ...d, updated_at: ctx.clock.now() }).where(eq(companies.id, id)).run();
    return { row: requireRow(ctx, "companies", id), effects: [] as string[] };
  }
  function remove(id: number) {
    const cur = requireRow(ctx, "companies", id);
    ctx.db.transaction((tx) => {
      tx.update(people).set({ company_id: null }).where(eq(people.company_id, id)).run();
      tx.delete(comments).where(and(eq(comments.target_type, "company"), eq(comments.target_id, id))).run();
      tx.delete(companies).where(eq(companies.id, id)).run();
      emit(tx, ctx, { type: "company.deleted", summary: `Firma silindi: ${cur.name}` });
    });
    return { effects: [] as string[] };
  }
  return { create, update, remove };
}

export function sourcesService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(sourceCreate, input);
    if (row(ctx, "SELECT 1 x FROM sources WHERE name = ? COLLATE NOCASE", d.name)) throw new FFError("validation", `"${d.name}" kaynağı zaten var`);
    const r = ctx.db.insert(sources).values({ ...d, ...stamp(ctx) }).returning().get();
    return { row: r, effects: [] as string[] };
  }
  function update(id: number, input: unknown) {
    const d = parse(sourceUpdate, input);
    requireRow(ctx, "sources", id);
    if (Object.keys(d).length) ctx.db.update(sources).set({ ...d, updated_at: ctx.clock.now() }).where(eq(sources.id, id)).run();
    return { row: requireRow(ctx, "sources", id), effects: [] as string[] };
  }
  function remove(id: number) {
    const cur = requireRow(ctx, "sources", id);
    if (row(ctx, "SELECT COUNT(*) n FROM opportunities WHERE source_id = ?", id)?.n) {
      throw new FFError("rule", `${cur.name} silinemez: bu kaynaktan fırsat var`);
    }
    ctx.db.delete(sources).where(eq(sources.id, id)).run();
    return { effects: [] as string[] };
  }
  return { create, update, remove };
}
