import { eq } from "drizzle-orm";
import { assertOzgur, emit, FFError, parse, stamp, type Ctx } from "../context";
import { drafts } from "../db/schema";
import { draftCreate, draftUpdate } from "../schemas";
import { z } from "zod";
import { insertTouch } from "./touches";
import { link, requireRow, truncate } from "./shared";
import { resolveSubject } from "./subject";
import { renderTemplate } from "./templates";
import { Bin } from "./trash";

/**
 * Taslak akışı: Claude (ya da Özgür) taslak bırakır → sadece Özgür onaylar / reddeder / "gönderdim" der.
 * Gönderildi: aynı bilgilerle giden temas oluşur (created_by = ozgur, draft_id dolu).
 */
export function draftsService(ctx: Ctx) {
  /** Muhatap kişi, firma ya da adres. Metin boşsa şablon muhataba uygulanarak doldurulur ({ad}, {firma}, {sektor}) */
  function create(input: unknown) {
    const p = parse(draftCreate, input);
    return ctx.db.transaction((tx) => {
      const sub = resolveSubject(ctx, p);
      const s = { person_id: sub.person_id, company_id: sub.company_id, contact: sub.contact };
      if (!s.person_id && (p.opportunity_id || p.project_id)) throw new FFError("validation", "fırsat ya da proje bağlantısı sadece kişiye yazılan taslakta olur");
      const tpl = p.template_id ? requireRow(ctx, "templates", p.template_id, "şablon") : null;
      const body = p.body ?? (tpl ? renderTemplate(ctx, tpl.body, s) : null);
      if (!body) throw new FFError("validation", "body: taslak metni ya da şablon gerekli");
      const d = { ...p, ...s, body };
      // gönderilince temas olacağı için bağlantılar şimdiden aynı kişiye ait olmalı
      for (const [key, table, what] of [["opportunity_id", "opportunities", "fırsat"], ["project_id", "projects", "proje"]] as const) {
        if (d[key] && requireRow(ctx, table, d[key]!).person_id !== d.person_id) throw new FFError("validation", `${what} #${d[key]} bu kişiye ait değil`);
      }
      const r = tx.insert(drafts).values({ ...d, status: "bekliyor", ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "draft.created", ...link(ctx, d), summary: `Taslak hazırlandı (${d.channel}): ${truncate(d.body, 50)}`, data: { draft_id: r.id } });
      return { row: r, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    const d = parse(draftUpdate, input);
    const cur = requireRow(ctx, "drafts", id);
    if (cur.status !== "bekliyor") throw new FFError("rule", `Taslak ${cur.status}; sadece bekleyen taslak düzenlenir`);
    if (Object.keys(d).length) ctx.db.update(drafts).set({ ...d, updated_at: ctx.clock.now() }).where(eq(drafts.id, id)).run();
    return { row: requireRow(ctx, "drafts", id), effects: [] as string[] };
  }

  function setStatus(id: number, from: string[], to: string, type: string, summary: string, extra: Record<string, unknown> = {}) {
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "drafts", id);
      if (!from.includes(cur.status)) throw new FFError("rule", `Taslak "${cur.status}" durumunda; bu işlem yapılamaz`);
      tx.update(drafts).set({ status: to as any, updated_at: ctx.clock.now(), ...extra }).where(eq(drafts.id, id)).run();
      emit(tx, ctx, { type, ...link(ctx, cur), summary, data: { draft_id: id } });
      return cur;
    });
  }

  function approve(id: number) {
    assertOzgur(ctx, "Taslak onayı");
    setStatus(id, ["bekliyor"], "onaylandi", "draft.approved", "Taslak onaylandı");
    return { row: requireRow(ctx, "drafts", id), effects: [] as string[] };
  }

  function reject(id: number, note: unknown) {
    assertOzgur(ctx, "Taslak reddi");
    const n = parse(z.string().trim().min(1, "ret nedeni gerekli"), note);
    setStatus(id, ["bekliyor", "onaylandi"], "reddedildi", "draft.rejected", `Taslak reddedildi: ${truncate(n, 60)}`, { reject_note: n });
    return { row: requireRow(ctx, "drafts", id), effects: [] as string[] };
  }

  /** "Gönderdim": taslak gonderildi olur, giden temas oluşur, fırsat aşaması kuralı çalışır */
  function markSent(id: number) {
    assertOzgur(ctx, "Taslak gönderildi işareti");
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "drafts", id);
      if (cur.status !== "bekliyor" && cur.status !== "onaylandi") throw new FFError("rule", `Taslak zaten ${cur.status}`);
      tx.update(drafts).set({ status: "gonderildi", updated_at: ctx.clock.now() }).where(eq(drafts.id, id)).run();
      const t = insertTouch(tx, ctx, {
        person_id: cur.person_id, company_id: cur.company_id, contact: cur.contact, opportunity_id: cur.opportunity_id, project_id: cur.project_id,
        channel: cur.channel, direction: "giden", kind: "mesaj", summary: cur.body, outcome: null, draft_id: id,
      });
      emit(tx, ctx, { type: "draft.sent", ...link(ctx, cur), summary: `Taslak gönderildi (${cur.channel})`, data: { draft_id: id, touch_id: t.row.id } });
      return { row: requireRow(ctx, "drafts", id), touch: t.row, effects: [`temas #${t.row.id} oluştu`, ...t.effects] };
    });
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "drafts", id);
    if (cur.status === "gonderildi") throw new FFError("rule", "Gönderilmiş taslak silinemez (temas kaydı ona bağlı)");
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.take("comments", "target_type = 'draft' AND target_id = ?", id);
      bin.take("drafts", "id = ?", id);
      bin.commit(tx, "draft", id, `Taslak: ${truncate(cur.body, 60)}`);
      emit(tx, ctx, { type: "draft.deleted", ...link(ctx, cur), summary: `Taslak silindi: ${truncate(cur.body, 50)}`, data: { draft_id: id } });
      return { effects: [] as string[], trash: { type: "draft", id } };
    });
  }

  return { create, update, approve, reject, markSent, remove };
}
