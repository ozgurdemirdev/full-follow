import { eq } from "drizzle-orm";
import {
  announceTrashed, assertUnique, assignSectors, assignTags, Bin, checkSource, FFError, keyList, parse, personKeys, requireRow, row, schema, stamp, withSectorList,
  writeEvent as emit, type Ctx,
} from "@fullfollow/core";
import { personCreate, personUpdate } from "./schemas";

const { people } = schema;

const FIELD_NAMES: Record<string, string> = {
  name: "ad", company_id: "firma", role: "rol", email: "e-posta", phone: "telefon", handle: "kullanıcı adı", instagram: "Instagram", linkedin: "LinkedIn",
  referred_by_id: "referans", post_id: "kaynak paylaşım", source_id: "nereden", contact_status: "durum", next_follow_up_at: "takip tarihi",
  notes: "not", tags: "etiket", sectors: "sektör",
};

export function peopleService(ctx: Ctx) {
  // TODO(modules): the post through ctx.mod("posts") (raw table read for now)
  function checkRefs(f: { company_id?: number | null; referred_by_id?: number | null; post_id?: number | null }) {
    if (f.company_id) requireRow(ctx, "companies", f.company_id);
    if (f.referred_by_id) requireRow(ctx, "people", f.referred_by_id, "referans kişisi");
    if (f.post_id) requireRow(ctx, "posts", f.post_id, "paylaşım");
  }

  /** The touches and drafts saved with only this address join the new person; the network module does it (nothing to adopt without it) */
  const adopt = (owner: { person_id: number }, keys: string[]) => ctx.mod("network")?.adoptLoose(owner, keys) ?? [];

  function create(input: unknown) {
    return ctx.db.transaction((tx) => {
      const { tags, add_tags, remove_tags, sectors, ...f } = parse(personCreate, withSectorList(input));
      checkRefs(f);
      checkSource(ctx, f.source_id);
      const keys = personKeys(f);
      assertUnique(ctx, keys);
      const r = tx.insert(people).values({ ...f, ...keys, ...stamp(ctx) }).returning().get();
      assignTags(tx, ctx, "person", r.id, { set: tags, add: add_tags, remove: remove_tags });
      assignSectors(tx, ctx, "person", r.id, sectors);
      emit(tx, ctx, { type: "person.created", person_id: r.id, summary: `Kişi eklendi: ${r.name}` });
      const effects = adopt({ person_id: r.id }, keyList(keys));
      return { row: requireRow(ctx, "people", r.id), effects };
    });
  }

  function update(id: number, input: unknown) {
    return ctx.db.transaction((tx) => {
      const { tags, add_tags, remove_tags, sectors, ...f } = parse(personUpdate, withSectorList(input));
      const cur = requireRow(ctx, "people", id);
      checkRefs(f);
      if (f.source_id !== undefined) checkSource(ctx, f.source_id, cur.source_id);
      if (f.referred_by_id) {
        // referans ağacında döngü olmasın: yeni referans, bu kişinin altında olmamalı
        for (let p: number | null = f.referred_by_id, guard = 0; p && guard < 1000; guard++) {
          if (p === id) throw new FFError("validation", "referans döngüsü: kişi kendi alt referansına bağlanamaz");
          p = row(ctx, "SELECT referred_by_id r FROM people WHERE id = ?", p)?.r ?? null;
        }
      }
      // sadece değişen anahtarlar kontrol edilir (eski kayıtlardaki çakışma güncellemeyi kilitlemesin)
      const keys = personKeys({ ...cur, ...f });
      const changedKeys = Object.fromEntries(Object.entries(keys).filter(([k, v]) => v !== cur[k]));
      assertUnique(ctx, changedKeys, { type: "person", id });
      const changed = Object.entries(f).filter(([k, v]) => v !== undefined && v !== cur[k]).map(([k]) => k);
      if (Object.keys(f).length) tx.update(people).set({ ...f, ...keys, updated_at: ctx.clock.now() }).where(eq(people.id, id)).run();
      if (assignTags(tx, ctx, "person", id, { set: tags, add: add_tags, remove: remove_tags })) changed.push("tags");
      if (assignSectors(tx, ctx, "person", id, sectors)) changed.push("sectors");
      if (changed.length) {
        const names = [...new Set(changed)].map((k) => FIELD_NAMES[k] ?? k).join(", ");
        tx.update(people).set({ updated_at: ctx.clock.now() }).where(eq(people.id, id)).run();
        emit(tx, ctx, { type: "person.updated", person_id: id, summary: `Kişi güncellendi (${names})` });
      }
      const effects = Object.keys(changedKeys).length ? adopt({ person_id: id }, keyList(changedKeys)) : [];
      return { row: requireRow(ctx, "people", id), effects };
    });
  }

  /**
   * Çöp kutusuna: kişi + temasları, notları, taslakları, görevleri, yorumları; fırsatı ya da projesi varsa silinmez.
   * Temaslar, görevler, taslaklar ve fikir bağları kendi modüllerinin işi (`record.trashed`); notlar henüz modül değil.
   * The opportunity team rows go through the pipeline module (`record.trashed`) too.
   */
  function remove(id: number) {
    const cur = requireRow(ctx, "people", id);
    if (ctx.mod("pipeline")?.opportunities.countOf(id)) throw new FFError("rule", `${cur.name} silinemez: fırsatları var, önce onları sil`);
    if (ctx.mod("projects")?.projects.countOf(id)) throw new FFError("rule", `${cur.name} silinemez: projesi var`);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.unlink("people", "referred_by_id", id);
      // touches, tasks (and the comments on them), drafts (and the comments on them), idea links and the opportunity team rows go through the modules that own them
      announceTrashed(ctx, bin, "person", id);
      // TODO(modules): notes clean their own rows when they hear `record.trashed` (raw take for now)
      bin.take("notes", "person_id = ?", id);
      bin.take("comments", "target_type = 'person' AND target_id = ?", id);
      bin.take("person_tags", "person_id = ?", id);
      bin.take("person_sectors", "person_id = ?", id);
      bin.take("people", "id = ?", id);
      bin.commit(tx, "person", id, cur.name, keyList(personKeys(cur)));
      emit(tx, ctx, { type: "person.deleted", summary: `Kişi silindi: ${cur.name}` });
      return { effects: [] as string[], trash: { type: "person", id } };
    });
  }

  return { create, update, remove };
}
