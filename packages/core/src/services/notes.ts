import { eq } from "drizzle-orm";
import { SUMMARY_PREVIEW_CHARS } from "../constants";
import { emit, FFError, parse, stamp, type Ctx } from "../context";
import { m } from "../messages";
import { notes } from "../db/schema";
import { noteCreate, noteUpdate } from "../schemas";
import { requireRow, truncate } from "./shared";
import { Bin } from "./trash";

/** Kişi kartındaki tarihli notlar. Metni sadece yazarı değiştirir; Claude sadece kendi notunu siler. */
export function notesService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(noteCreate, input);
    return ctx.db.transaction((tx) => {
      const p = requireRow(ctx, "people", d.person_id);
      const r = tx.insert(notes).values({ ...d, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "note.created", person_id: p.id, summary: m.notes.entry(truncate(d.body, SUMMARY_PREVIEW_CHARS)), data: { note_id: r.id } });
      return { row: r, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    const d = parse(noteUpdate, input);
    const cur = requireRow(ctx, "notes", id);
    if (d.body !== undefined) {
      if (cur.created_by !== ctx.actor) throw new FFError("forbidden", m.notes.authorOnlyEdit);
      ctx.db.update(notes).set({ body: d.body, updated_at: ctx.clock.now() }).where(eq(notes.id, id)).run();
    }
    return { row: requireRow(ctx, "notes", id), effects: [] as string[] };
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "notes", id);
    if (ctx.actor !== "ozgur" && cur.created_by !== ctx.actor) throw new FFError("forbidden", m.notes.claudeOnlyOwn);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.take("notes", "id = ?", id);
      bin.commit(tx, "note", id, m.notes.entry(truncate(cur.body, SUMMARY_PREVIEW_CHARS)));
      emit(tx, ctx, { type: "note.deleted", person_id: cur.person_id, summary: m.notes.deleted(truncate(cur.body, SUMMARY_PREVIEW_CHARS)) });
      return { effects: [] as string[], trash: { type: "note", id } };
    });
  }

  return { create, update, remove };
}
