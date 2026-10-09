import { and, eq, inArray } from "drizzle-orm";
import { emit, FFError, parse, row, rows, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { comments, drafts, events, opportunities, people, person_tags, tasks, touches } from "../db/schema";
import { personCreate, personUpdate } from "../schemas";
import { requireRow } from "./shared";

const FIELD_NAMES: Record<string, string> = {
  name: "ad", company_id: "firma", email: "e-posta", phone: "telefon", handle: "kullanıcı adı",
  referred_by_id: "referans", next_follow_up_at: "takip tarihi", notes: "not", tags: "etiket",
};

export function addTags(q: Q, ctx: Ctx, personId: number, tags: readonly string[]): string[] {
  const added: string[] = [];
  for (const tag of tags) {
    const r = q.insert(person_tags).values({ person_id: personId, tag: tag as any, created_at: ctx.clock.now(), created_by: ctx.actor })
      .onConflictDoNothing().run();
    if (r.changes) added.push(tag);
  }
  return added;
}

export function peopleService(ctx: Ctx) {
  function create(input: unknown) {
    const { tags, ...f } = parse(personCreate, input);
    return ctx.db.transaction((tx) => {
      if (f.company_id) requireRow(ctx, "companies", f.company_id);
      if (f.referred_by_id) requireRow(ctx, "people", f.referred_by_id, "referans kişisi");
      const r = tx.insert(people).values({ ...f, ...stamp(ctx) }).returning().get();
      if (tags?.length) addTags(tx, ctx, r.id, tags);
      emit(tx, ctx, { type: "person.created", person_id: r.id, summary: `Kişi eklendi: ${r.name}` });
      return { row: r, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    const { tags, add_tags, remove_tags, ...f } = parse(personUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "people", id);
      if (f.company_id) requireRow(ctx, "companies", f.company_id);
      if (f.referred_by_id) {
        requireRow(ctx, "people", f.referred_by_id, "referans kişisi");
        // referans ağacında döngü olmasın: yeni referans, bu kişinin altında olmamalı
        for (let p: number | null = f.referred_by_id, guard = 0; p && guard < 1000; guard++) {
          if (p === id) throw new FFError("validation", "referans döngüsü: kişi kendi alt referansına bağlanamaz");
          p = row(ctx, "SELECT referred_by_id r FROM people WHERE id = ?", p)?.r ?? null;
        }
      }
      const changed = Object.keys(f).filter((k) => (f as any)[k] !== undefined && (f as any)[k] !== (cur as any)[k]);
      if (Object.keys(f).length) tx.update(people).set({ ...f, updated_at: ctx.clock.now() }).where(eq(people.id, id)).run();
      if (tags) {
        tx.delete(person_tags).where(eq(person_tags.person_id, id)).run();
        addTags(tx, ctx, id, tags);
        changed.push("tags");
      }
      if (add_tags?.length && addTags(tx, ctx, id, add_tags).length) changed.push("tags");
      for (const tag of remove_tags ?? []) {
        if (tx.delete(person_tags).where(and(eq(person_tags.person_id, id), eq(person_tags.tag, tag))).run().changes) changed.push("tags");
      }
      if (changed.length) {
        const names = [...new Set(changed)].map((k) => FIELD_NAMES[k] ?? k).join(", ");
        tx.update(people).set({ updated_at: ctx.clock.now() }).where(eq(people.id, id)).run();
        emit(tx, ctx, { type: "person.updated", person_id: id, summary: `Kişi güncellendi (${names})` });
      }
      return { row: requireRow(ctx, "people", id), effects: [] as string[] };
    });
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "people", id);
    const n = (sql: string) => row(ctx, sql, id)?.n ?? 0;
    if (n("SELECT COUNT(*) n FROM opportunities WHERE person_id = ?")) throw new FFError("rule", `${cur.name} silinemez: fırsatları var, önce onları sil`);
    if (n("SELECT COUNT(*) n FROM projects WHERE person_id = ?")) throw new FFError("rule", `${cur.name} silinemez: projesi var`);
    ctx.db.transaction((tx) => {
      tx.update(people).set({ referred_by_id: null }).where(eq(people.referred_by_id, id)).run();
      tx.delete(person_tags).where(eq(person_tags.person_id, id)).run();
      // kişiyle giden taslak ve görevlerin yorumları da gitsin
      for (const [type, table] of [["draft", "drafts"], ["task", "tasks"]] as const) {
        const ids = rows<{ id: number }>(ctx, `SELECT id FROM ${table} WHERE person_id = ?`, id).map((r) => r.id);
        if (ids.length) tx.delete(comments).where(and(eq(comments.target_type, type), inArray(comments.target_id, ids))).run();
      }
      tx.delete(touches).where(eq(touches.person_id, id)).run();
      tx.delete(drafts).where(eq(drafts.person_id, id)).run();
      tx.delete(tasks).where(eq(tasks.person_id, id)).run();
      tx.delete(comments).where(and(eq(comments.target_type, "person"), eq(comments.target_id, id))).run();
      tx.delete(people).where(eq(people.id, id)).run();
      emit(tx, ctx, { type: "person.deleted", summary: `Kişi silindi: ${cur.name}` });
    });
    return { effects: [] as string[] };
  }

  return { create, update, remove };
}
