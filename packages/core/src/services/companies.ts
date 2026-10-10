import { eq } from "drizzle-orm";
import { emit, parse, stamp, type Ctx } from "../context";
import { companies } from "../db/schema";
import { companyKeys } from "../keys";
import { companyCreate, companyUpdate } from "../schemas";
import { assignSectors, assignTags, checkSource } from "./categories";
import { assertUnique, keyList } from "./dupes";
import { adoptLoose, withSectorList } from "./people";
import { requireRow } from "./shared";
import { Bin } from "./trash";

const FIELD_NAMES: Record<string, string> = {
  name: "ad", website: "web sitesi", email: "e-posta", phone: "telefon", instagram: "Instagram", linkedin: "LinkedIn",
  source_id: "nereden", contact_status: "durum", notes: "not", tags: "etiket", sectors: "sektör",
};

/**
 * Firma: kişiler firmaya bağlanır; firmaya doğrudan (info@ gibi) temas ve taslak da yazılır.
 * Ad, alan adı, e-posta, LinkedIn ve Instagram tektir (mükerrer kontrolü).
 */
export function companiesService(ctx: Ctx) {
  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const { tags, add_tags, remove_tags, sectors, ...d } = parse(companyCreate, withSectorList(input));
      checkSource(ctx, d.source_id);
      const keys = companyKeys(d);
      assertUnique(ctx, keys);
      const r = tx.insert(companies).values({ ...d, ...keys, ...stamp(ctx) }).returning().get();
      assignTags(tx, ctx, "company", r.id, { set: tags, add: add_tags, remove: remove_tags });
      assignSectors(tx, ctx, "company", r.id, sectors);
      emit(tx, ctx, { type: "company.created", summary: `Firma eklendi: ${r.name}`, data: { company_id: r.id } });
      const effects = adoptLoose(ctx, { company_id: r.id }, keyList(keys));
      return { row: requireRow(ctx, "companies", r.id), effects };
    });
  }

  function update(id: number, input: unknown) {
    return ctx.db.transaction((tx) => {
      const { tags, add_tags, remove_tags, sectors, ...d } = parse(companyUpdate, withSectorList(input));
      const cur = requireRow(ctx, "companies", id);
      if (d.source_id !== undefined) checkSource(ctx, d.source_id, cur.source_id);
      const keys = companyKeys({ ...cur, ...d });
      const changedKeys = Object.fromEntries(Object.entries(keys).filter(([k, v]) => v !== cur[k]));
      assertUnique(ctx, changedKeys, { type: "company", id });
      const changed = Object.keys(d).filter((k) => (d as any)[k] !== undefined && (d as any)[k] !== (cur as any)[k]);
      if (Object.keys(d).length) tx.update(companies).set({ ...d, ...keys, updated_at: ctx.clock.now() }).where(eq(companies.id, id)).run();
      if (assignTags(tx, ctx, "company", id, { set: tags, add: add_tags, remove: remove_tags })) changed.push("tags");
      if (assignSectors(tx, ctx, "company", id, sectors)) changed.push("sectors");
      if (changed.length) {
        tx.update(companies).set({ updated_at: ctx.clock.now() }).where(eq(companies.id, id)).run();
        const names = [...new Set(changed)].map((k) => FIELD_NAMES[k] ?? k).join(", ");
        emit(tx, ctx, { type: "company.updated", summary: `Firma güncellendi: ${d.name ?? cur.name} (${names})`, data: { company_id: id } });
      }
      const effects = Object.keys(changedKeys).length ? adoptLoose(ctx, { company_id: id }, keyList(changedKeys)) : [];
      return { row: requireRow(ctx, "companies", id), effects };
    });
  }

  /** Çöp kutusuna: firma + doğrudan temasları, taslakları, yorumları. Çalışanlar kalır, firma bağları boşalır (geri yüklenince döner). */
  function remove(id: number) {
    const cur = requireRow(ctx, "companies", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.unlink("people", "company_id", id);
      bin.take("comments", "target_type = 'draft' AND target_id IN (SELECT id FROM drafts WHERE company_id = ?)", id);
      bin.take("touches", "company_id = ?", id);
      bin.take("drafts", "company_id = ?", id);
      bin.take("comments", "target_type = 'company' AND target_id = ?", id);
      bin.take("company_tags", "company_id = ?", id);
      bin.take("company_sectors", "company_id = ?", id);
      bin.take("companies", "id = ?", id);
      bin.commit(tx, "company", id, cur.name, keyList(companyKeys(cur)));
      emit(tx, ctx, { type: "company.deleted", summary: `Firma silindi: ${cur.name}` });
      return { effects: [] as string[], trash: { type: "company", id } };
    });
  }

  return { create, update, remove };
}
