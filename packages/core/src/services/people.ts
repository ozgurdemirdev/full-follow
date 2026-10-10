import { eq } from "drizzle-orm";
import { emit, FFError, parse, row, rows, stamp, type Ctx } from "../context";
import { people } from "../db/schema";
import { contactKey, personKeys } from "../keys";
import { personCreate, personUpdate } from "../schemas";
import { assignSectors, assignTags, checkSource } from "./categories";
import { assertUnique, keyList } from "./dupes";
import { requireRow } from "./shared";
import { bumpStatus, statusOfTouch } from "./status";
import { Bin } from "./trash";

/** Eski tek sektör girdisi (`sector: "Sağlık > Diş hekimi"`) çoklu sektör listesine çevrilir */
export function withSectorList(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("sector" in input)) return input;
  const { sector, ...rest } = input as Record<string, any>;
  return rest.sectors !== undefined ? rest : { ...rest, sectors: sector === null || sector === "" ? [] : [sector] };
}

const FIELD_NAMES: Record<string, string> = {
  name: "ad", company_id: "firma", role: "rol", email: "e-posta", phone: "telefon", handle: "kullanıcı adı", instagram: "Instagram", linkedin: "LinkedIn",
  referred_by_id: "referans", post_id: "kaynak paylaşım", source_id: "nereden", contact_status: "durum", next_follow_up_at: "takip tarihi",
  notes: "not", tags: "etiket", sectors: "sektör",
};

/**
 * Sadece adresle kaydedilmiş temas ve taslaklar (info@, @hesap), aynı adresle açılan kişi ya da firmaya bağlanır.
 * Bağlanan temaslar kaydın durumunu da ilerletir.
 */
export function adoptLoose(ctx: Ctx, owner: { person_id?: number; company_id?: number }, keys: string[]): string[] {
  const wanted = new Set(keys.map((k) => (k.startsWith("email:") || k.startsWith("instagram:") || k.startsWith("linkedin:") ? k : "")).filter(Boolean));
  if (!wanted.size) return [];
  const col = owner.person_id ? "person_id" : "company_id";
  const id = owner.person_id ?? owner.company_id!;
  const loose = rows<{ id: number; direction: string; kind: string; contact_key: string }>(ctx,
    `SELECT id, direction, kind, contact_key FROM touches WHERE person_id IS NULL AND company_id IS NULL AND contact_key IN (${[...wanted].map(() => "?").join(",")})`, ...wanted);
  for (const t of loose) {
    ctx.sqlite.prepare(`UPDATE touches SET ${col} = ? WHERE id = ?`).run(id, t.id);
    bumpStatus(ctx, owner, statusOfTouch(t));
  }
  const drafts = rows<{ id: number; contact: string }>(ctx, "SELECT id, contact FROM drafts WHERE person_id IS NULL AND company_id IS NULL AND contact IS NOT NULL")
    .filter((d) => wanted.has(contactKey(d.contact) ?? ""));
  for (const d of drafts) ctx.sqlite.prepare(`UPDATE drafts SET ${col} = ? WHERE id = ?`).run(id, d.id);
  return loose.length ? [`${loose.length} temas bağlandı`] : [];
}

export function peopleService(ctx: Ctx) {
  function checkRefs(f: { company_id?: number | null; referred_by_id?: number | null; post_id?: number | null }) {
    if (f.company_id) requireRow(ctx, "companies", f.company_id);
    if (f.referred_by_id) requireRow(ctx, "people", f.referred_by_id, "referans kişisi");
    if (f.post_id) requireRow(ctx, "posts", f.post_id, "paylaşım");
  }

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
      const effects = adoptLoose(ctx, { person_id: r.id }, keyList(keys));
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
      const changed = Object.keys(f).filter((k) => (f as any)[k] !== undefined && (f as any)[k] !== (cur as any)[k]);
      if (Object.keys(f).length) tx.update(people).set({ ...f, ...keys, updated_at: ctx.clock.now() }).where(eq(people.id, id)).run();
      if (assignTags(tx, ctx, "person", id, { set: tags, add: add_tags, remove: remove_tags })) changed.push("tags");
      if (assignSectors(tx, ctx, "person", id, sectors)) changed.push("sectors");
      if (changed.length) {
        const names = [...new Set(changed)].map((k) => FIELD_NAMES[k] ?? k).join(", ");
        tx.update(people).set({ updated_at: ctx.clock.now() }).where(eq(people.id, id)).run();
        emit(tx, ctx, { type: "person.updated", person_id: id, summary: `Kişi güncellendi (${names})` });
      }
      const effects = Object.keys(changedKeys).length ? adoptLoose(ctx, { person_id: id }, keyList(changedKeys)) : [];
      return { row: requireRow(ctx, "people", id), effects };
    });
  }

  /** Çöp kutusuna: kişi + temasları, notları, taslakları, görevleri, yorumları; fırsatı ya da projesi varsa silinmez */
  function remove(id: number) {
    const cur = requireRow(ctx, "people", id);
    const n = (sql: string) => row(ctx, sql, id)?.n ?? 0;
    if (n("SELECT COUNT(*) n FROM opportunities WHERE person_id = ?")) throw new FFError("rule", `${cur.name} silinemez: fırsatları var, önce onları sil`);
    if (n("SELECT COUNT(*) n FROM projects WHERE person_id = ?")) throw new FFError("rule", `${cur.name} silinemez: projesi var`);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.unlink("people", "referred_by_id", id);
      for (const [type, table] of [["draft", "drafts"], ["task", "tasks"]] as const) {
        bin.take("comments", `target_type = '${type}' AND target_id IN (SELECT id FROM ${table} WHERE person_id = ?)`, id);
      }
      bin.take("idea_people", "person_id = ?", id);
      bin.take("touches", "person_id = ?", id);
      bin.take("notes", "person_id = ?", id);
      bin.take("drafts", "person_id = ?", id);
      bin.take("tasks", "person_id = ?", id);
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
