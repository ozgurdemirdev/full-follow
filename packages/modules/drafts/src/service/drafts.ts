import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  assertOzgur, Bin, eventLink as link, FFError, parse, renderTemplate, requireRow, resolveSubject, sameSide, schema, stamp, truncate, writeEvent as emit,
  type Ctx, type DraftRecord, type TemplateRecord,
} from "@fullfollow/core";
import { draftCreate, draftUpdate } from "./schemas";

const { drafts } = schema;

/**
 * Taslak akışı: Claude (ya da Özgür) taslak bırakır → sadece Özgür onaylar / reddeder / "gönderdim" der.
 * Gönderildi: aynı bilgilerle giden temas oluşur (created_by = ozgur, draft_id dolu).
 */
export function draftsService(ctx: Ctx) {
  /** The template row of a draft made from one; the templates module owns them */
  function templateOf(id: number): TemplateRecord {
    const templates = ctx.mod("templates");
    if (!templates) throw new FFError("validation", `şablon verildi (#${id}) ama "templates" modülü kurulu değil`);
    const t = templates.ref(id);
    if (!t) throw new FFError("not_found", `şablon #${id} bulunamadı`);
    return t;
  }

  /** Muhatap kişi, firma ya da adres. Metin boşsa şablon muhataba uygulanarak doldurulur ({ad}, {firma}, {sektor}) */
  function create(input: unknown) {
    const p = parse(draftCreate, input);
    return ctx.db.transaction((tx) => {
      const sub = resolveSubject(ctx, p);
      const s = { person_id: sub.person_id, company_id: sub.company_id, contact: sub.contact };
      if (!s.person_id && (p.opportunity_id || p.project_id)) throw new FFError("validation", "fırsat ya da proje bağlantısı sadece kişiye yazılan taslakta olur");
      const tpl = p.template_id ? templateOf(p.template_id) : null;
      const body = p.body ?? (tpl ? renderTemplate(ctx, tpl.body, s) : null);
      if (!body) throw new FFError("validation", "body: taslak metni ya da şablon gerekli");
      const d = { ...p, ...s, body };
      // gönderilince temas olacağı için bağlantılar şimdiden aynı kişiye ya da firmasına ait olmalı
      for (const [key, what, owner, find] of [
        ["opportunity_id", "fırsat", "pipeline", (id: number) => ctx.mod("pipeline")?.opportunities.ref(id)],
        ["project_id", "proje", "projects", (id: number) => ctx.mod("projects")?.projects.ref(id)],
      ] as const) {
        if (!d[key]) continue;
        if (!ctx.mod(owner)) throw new FFError("validation", `${what} verildi (#${d[key]}) ama "${owner}" modülü kurulu değil`);
        const rec = find(d[key]!);
        if (!rec) throw new FFError("not_found", `${what} #${d[key]} bulunamadı`);
        if (!sameSide(ctx, rec.person_id, d)) throw new FFError("validation", `${what} #${d[key]} bu kişiye ya da firmasına ait değil`);
      }
      const r = tx.insert(drafts).values({ ...d, status: "bekliyor", ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "draft.created", ...link(ctx, d), summary: `Taslak hazırlandı (${d.channel}): ${truncate(d.body, 50)}`, data: { draft_id: r.id } });
      return { row: r as DraftRecord, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    const d = parse(draftUpdate, input);
    const cur = requireRow(ctx, "drafts", id);
    if (cur.status !== "bekliyor") throw new FFError("rule", `Taslak ${cur.status}; sadece bekleyen taslak düzenlenir`);
    if (Object.keys(d).length) ctx.db.update(drafts).set({ ...d, updated_at: ctx.clock.now() }).where(eq(drafts.id, id)).run();
    return { row: requireRow<DraftRecord>(ctx, "drafts", id), effects: [] as string[] };
  }

  function setStatus(id: number, from: string[], to: DraftRecord["status"], type: string, summary: string, extra: Record<string, unknown> = {}) {
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "drafts", id);
      if (!from.includes(cur.status)) throw new FFError("rule", `Taslak "${cur.status}" durumunda; bu işlem yapılamaz`);
      tx.update(drafts).set({ status: to, updated_at: ctx.clock.now(), ...extra }).where(eq(drafts.id, id)).run();
      emit(tx, ctx, { type, ...link(ctx, cur), summary, data: { draft_id: id } });
      return cur;
    });
  }

  function approve(id: number) {
    assertOzgur(ctx, "Taslak onayı");
    setStatus(id, ["bekliyor"], "onaylandi", "draft.approved", "Taslak onaylandı");
    return { row: requireRow<DraftRecord>(ctx, "drafts", id), effects: [] as string[] };
  }

  function reject(id: number, note: unknown) {
    assertOzgur(ctx, "Taslak reddi");
    const n = parse(z.string().trim().min(1, "ret nedeni gerekli"), note);
    setStatus(id, ["bekliyor", "onaylandi"], "reddedildi", "draft.rejected", `Taslak reddedildi: ${truncate(n, 60)}`, { reject_note: n });
    return { row: requireRow<DraftRecord>(ctx, "drafts", id), effects: [] as string[] };
  }

  /** "Gönderdim": taslak gonderildi olur, giden temas oluşur, fırsat aşaması kuralı çalışır (temas network modülü kuruluysa) */
  function markSent(id: number) {
    assertOzgur(ctx, "Taslak gönderildi işareti");
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "drafts", id);
      if (cur.status !== "bekliyor" && cur.status !== "onaylandi") throw new FFError("rule", `Taslak zaten ${cur.status}`);
      tx.update(drafts).set({ status: "gonderildi", updated_at: ctx.clock.now() }).where(eq(drafts.id, id)).run();
      const t = ctx.mod("network")?.touches.insert(tx, {
        person_id: cur.person_id, company_id: cur.company_id, contact: cur.contact, opportunity_id: cur.opportunity_id, project_id: cur.project_id,
        channel: cur.channel, direction: "giden", kind: "mesaj", summary: cur.body, outcome: null, draft_id: id,
      });
      emit(tx, ctx, { type: "draft.sent", ...link(ctx, cur), summary: `Taslak gönderildi (${cur.channel})`, data: { draft_id: id, touch_id: t?.row.id } });
      return { row: requireRow<DraftRecord>(ctx, "drafts", id), touch: t?.row, effects: t ? [`temas #${t.row.id} oluştu`, ...t.effects] : [] };
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
