import { eq } from "drizzle-orm";
import {
  assertOzgur, Bin, eventLink as link, FFError, parse, renderTemplate, requireRow, resolveSubject, sameSide, schema, stamp, truncate, writeEvent as emit,
  type Ctx, type DraftRecord, type TemplateRecord,
} from "@fullfollow/core";
import { m } from "../messages";
import { EVENT_NOTE_LENGTH, EVENT_TEXT_LENGTH, REJECT_NO_REASON_NOTE } from "./constants";
import { learnRule } from "./rules";
import { draftCreate, draftReject, draftUpdate } from "./schemas";

const { drafts } = schema;

/**
 * Taslak akışı: Claude (ya da Özgür) taslak bırakır → sadece Özgür onaylar / reddeder / "gönderdim" der.
 * Gönderildi: aynı bilgilerle giden temas oluşur (created_by = ozgur, draft_id dolu).
 */
export function draftsService(ctx: Ctx) {
  /** The template row of a draft made from one; the templates module owns them */
  function templateOf(id: number): TemplateRecord {
    const templates = ctx.mod("templates");
    if (!templates) throw new FFError("validation", m.error.templateModuleMissing(id));
    const t = templates.ref(id);
    if (!t) throw new FFError("not_found", m.error.templateNotFound(id));
    return t;
  }

  /** Muhatap kişi, firma ya da adres. Metin boşsa şablon muhataba uygulanarak doldurulur ({ad}, {firma}, {sektor}) */
  function create(input: unknown) {
    const p = parse(draftCreate, input);
    return ctx.db.transaction((tx) => {
      const sub = resolveSubject(ctx, p);
      const s = { person_id: sub.person_id, company_id: sub.company_id, contact: sub.contact };
      if (!s.person_id && (p.opportunity_id || p.project_id)) throw new FFError("validation", m.error.linkOnlyPerson);
      const tpl = p.template_id ? templateOf(p.template_id) : null;
      const body = p.body ?? (tpl ? renderTemplate(ctx, tpl.body, s) : null);
      if (!body) throw new FFError("validation", m.error.bodyRequired);
      const d = { ...p, ...s, body };
      // gönderilince temas olacağı için bağlantılar şimdiden aynı kişiye ya da firmasına ait olmalı
      for (const [key, what, owner, find] of [
        ["opportunity_id", m.linkNouns.opportunity, "pipeline", (id: number) => ctx.mod("pipeline")?.opportunities.ref(id)],
        ["project_id", m.linkNouns.project, "projects", (id: number) => ctx.mod("projects")?.projects.ref(id)],
      ] as const) {
        if (!d[key]) continue;
        if (!ctx.mod(owner)) throw new FFError("validation", m.error.linkModuleMissing(what, d[key]!, owner));
        const rec = find(d[key]!);
        if (!rec) throw new FFError("not_found", m.error.linkNotFound(what, d[key]!));
        if (!sameSide(ctx, rec.person_id, d)) throw new FFError("validation", m.error.linkNotTheirs(what, d[key]!));
      }
      const r = tx.insert(drafts).values({ ...d, status: "bekliyor", ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "draft.created", ...link(ctx, d), summary: m.event.created(d.channel, truncate(d.body, EVENT_TEXT_LENGTH)), data: { draft_id: r.id } });
      return { row: r as DraftRecord, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    const d = parse(draftUpdate, input);
    const cur = requireRow(ctx, "drafts", id);
    if (cur.status !== "bekliyor") throw new FFError("rule", m.error.onlyPendingEdit(cur.status));
    if (Object.keys(d).length) ctx.db.update(drafts).set({ ...d, updated_at: ctx.clock.now() }).where(eq(drafts.id, id)).run();
    return { row: requireRow<DraftRecord>(ctx, "drafts", id), effects: [] as string[] };
  }

  function setStatus(id: number, from: string[], to: DraftRecord["status"], type: string, summary: string, extra: Record<string, unknown> = {}) {
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "drafts", id);
      if (!from.includes(cur.status)) throw new FFError("rule", m.error.wrongStatus(cur.status));
      tx.update(drafts).set({ status: to, updated_at: ctx.clock.now(), ...extra }).where(eq(drafts.id, id)).run();
      emit(tx, ctx, { type, ...link(ctx, cur), summary, data: { draft_id: id } });
      return cur;
    });
  }

  function approve(id: number) {
    assertOzgur(ctx, m.who.approve);
    setStatus(id, ["bekliyor"], "onaylandi", "draft.approved", m.event.approved);
    return { row: requireRow<DraftRecord>(ctx, "drafts", id), effects: [] as string[] };
  }

  /** `input` is `{ note }` or `{ no_reason: true }` (a bare text counts as the note); only a real note becomes a learned rule */
  function reject(id: number, input: unknown) {
    assertOzgur(ctx, m.who.reject);
    const { note, no_reason } = parse(draftReject, input);
    const n = note || REJECT_NO_REASON_NOTE;
    ctx.db.transaction(() => {
      setStatus(id, ["bekliyor", "onaylandi"], "reddedildi", "draft.rejected", m.event.rejected(truncate(n, EVENT_NOTE_LENGTH)), { reject_note: n });
      if (note && !no_reason) learnRule(ctx, note);
    });
    return { row: requireRow<DraftRecord>(ctx, "drafts", id), effects: [] as string[] };
  }

  /** "Gönderdim": taslak gonderildi olur, giden temas oluşur, fırsat aşaması kuralı çalışır (temas network modülü kuruluysa) */
  function markSent(id: number) {
    assertOzgur(ctx, m.who.send);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "drafts", id);
      if (cur.status !== "bekliyor" && cur.status !== "onaylandi") throw new FFError("rule", m.error.alreadyStatus(cur.status));
      tx.update(drafts).set({ status: "gonderildi", updated_at: ctx.clock.now() }).where(eq(drafts.id, id)).run();
      const t = ctx.mod("network")?.touches.insert(tx, {
        person_id: cur.person_id, company_id: cur.company_id, contact: cur.contact, opportunity_id: cur.opportunity_id, project_id: cur.project_id,
        channel: cur.channel, direction: "giden", kind: "mesaj", summary: cur.body, outcome: null, draft_id: id,
      });
      emit(tx, ctx, { type: "draft.sent", ...link(ctx, cur), summary: m.event.sent(cur.channel), data: { draft_id: id, touch_id: t?.row.id } });
      return { row: requireRow<DraftRecord>(ctx, "drafts", id), touch: t?.row, effects: t ? [m.effect.touch(t.row.id), ...t.effects] : [] };
    });
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "drafts", id);
    if (cur.status === "gonderildi") throw new FFError("rule", m.error.sentCannotDelete);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.take("comments", "target_type = 'draft' AND target_id = ?", id);
      bin.take("drafts", "id = ?", id);
      bin.commit(tx, "draft", id, m.trashDraft(truncate(cur.body, EVENT_NOTE_LENGTH)));
      emit(tx, ctx, { type: "draft.deleted", ...link(ctx, cur), summary: m.event.deleted(truncate(cur.body, EVENT_TEXT_LENGTH)), data: { draft_id: id } });
      return { effects: [] as string[], trash: { type: "draft", id } };
    });
  }

  return { create, update, approve, reject, markSent, remove };
}
