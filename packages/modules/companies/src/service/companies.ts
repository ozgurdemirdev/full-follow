import { eq } from "drizzle-orm";
import {
  announceTrashed, assertUnique, assignSectors, assignTags, Bin, checkSource, companyKeys, keyList, parse, requireRow, schema, stamp, withSectorList,
  writeEvent as emit, type Ctx,
} from "@fullfollow/core";
import { m } from "../messages";
import { companyCreate, companyUpdate } from "./schemas";

const { companies } = schema;

const FIELD_NAMES: Record<string, string> = m.fieldNames;

/**
 * Firma: kişiler firmaya bağlanır; firmaya doğrudan (info@ gibi) temas ve taslak da yazılır.
 * Ad, alan adı, e-posta, LinkedIn ve Instagram tektir (mükerrer kontrolü).
 */
export function companiesService(ctx: Ctx) {
  /** The touches and drafts saved with only this address join the new company; the network module does it (nothing to adopt without it) */
  const adopt = (owner: { company_id: number }, keys: string[]) => ctx.mod("network")?.adoptLoose(owner, keys) ?? [];

  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const { tags, add_tags, remove_tags, sectors, ...d } = parse(companyCreate, withSectorList(input));
      checkSource(ctx, d.source_id);
      const keys = companyKeys(d);
      assertUnique(ctx, keys);
      const r = tx.insert(companies).values({ ...d, ...keys, ...stamp(ctx) }).returning().get();
      assignTags(tx, ctx, "company", r.id, { set: tags, add: add_tags, remove: remove_tags });
      assignSectors(tx, ctx, "company", r.id, sectors);
      emit(tx, ctx, { type: "company.created", summary: m.events.created(r.name), data: { company_id: r.id } });
      const effects = adopt({ company_id: r.id }, keyList(keys));
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
      const changed = Object.entries(d).filter(([k, v]) => v !== undefined && v !== cur[k]).map(([k]) => k);
      if (Object.keys(d).length) tx.update(companies).set({ ...d, ...keys, updated_at: ctx.clock.now() }).where(eq(companies.id, id)).run();
      if (assignTags(tx, ctx, "company", id, { set: tags, add: add_tags, remove: remove_tags })) changed.push("tags");
      if (assignSectors(tx, ctx, "company", id, sectors)) changed.push("sectors");
      if (changed.length) {
        tx.update(companies).set({ updated_at: ctx.clock.now() }).where(eq(companies.id, id)).run();
        const names = [...new Set(changed)].map((k) => FIELD_NAMES[k] ?? k).join(", ");
        emit(tx, ctx, { type: "company.updated", summary: m.events.updated(d.name ?? cur.name, names), data: { company_id: id } });
      }
      const effects = Object.keys(changedKeys).length ? adopt({ company_id: id }, keyList(changedKeys)) : [];
      return { row: requireRow(ctx, "companies", id), effects };
    });
  }

  /**
   * Çöp kutusuna: firma + doğrudan temasları, taslakları, yorumları. Çalışanlar kalır, firma bağları boşalır (geri yüklenince döner).
   * Çalışanlar, temaslar, görevler ve taslaklar kendi modüllerinin işi (`record.trashed`).
   */
  function remove(id: number) {
    const cur = requireRow(ctx, "companies", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      // the people of the company lose the link (people), its own touches, the tasks hanging on it and its drafts go (network, calendar, drafts)
      announceTrashed(ctx, bin, "company", id);
      bin.take("comments", "target_type = 'company' AND target_id = ?", id);
      bin.take("company_tags", "company_id = ?", id);
      bin.take("company_sectors", "company_id = ?", id);
      bin.take("companies", "id = ?", id);
      bin.commit(tx, "company", id, cur.name, keyList(companyKeys(cur)));
      emit(tx, ctx, { type: "company.deleted", summary: m.events.deleted(cur.name) });
      return { effects: [] as string[], trash: { type: "company", id } };
    });
  }

  return { create, update, remove };
}
