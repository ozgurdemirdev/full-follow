import { eq } from "drizzle-orm";
import { OPP_STAGES } from "../constants";
import { emit, parse, rows, stamp, FFError, type Ctx } from "../context";
import type { Q } from "../db/client";
import { touches } from "../db/schema";
import { touchCreate, touchUpdate } from "../schemas";
import { applyStage } from "./opportunities";
import { link, requireRow, truncate } from "./shared";
import { upsertInterest } from "./ideas";
import { bumpStatus, statusOfTouch } from "./status";
import { resolveSubject } from "./subject";
import { Bin } from "./trash";
import { z } from "zod";

type TouchInput = z.infer<typeof touchCreate> & { draft_id?: number };

/** The record's own person, a colleague at the same company, or that company itself (e.g. a reply sent "as Örnek Pizza") */
export function sameSide(ctx: Ctx, ownerId: number, s: { person_id?: number | null; company_id?: number | null }) {
  if (s.person_id === ownerId) return true;
  const own = rows<{ company_id: number | null }>(ctx, "SELECT company_id FROM people WHERE id = ?", ownerId)[0]?.company_id;
  if (!own) return false;
  if (s.person_id) return rows(ctx, "SELECT 1 FROM people WHERE id = ? AND company_id = ?", s.person_id, own).length > 0;
  return s.company_id === own;
}

/**
 * Temas kaydeder; muhatap kişi, firma ya da sadece adres olabilir (subject.ts).
 * Kişinin ve firmasının temas durumu ilerler (yazıldı → cevap geldi → görüşüldü).
 * Kişi temasında fırsat aşaması da ilerler: bulundu + giden → temas, temas + gelen → cevap, görüşme türü → gorusme. Teklif ve sonrasına dokunmaz.
 * Fırsat verilmediyse kişinin tek açık fırsatı varsa ona bağlanır.
 */
export function insertTouch(q: Q, ctx: Ctx, d: TouchInput) {
  const s = resolveSubject(ctx, d);
  let oppId = d.opportunity_id ?? null;
  if (!s.person_id && (d.idea_id || (!s.company_id && (oppId || d.project_id)))) throw new FFError("validation", "fikir bağlantısı sadece kişiye, fırsat ve proje bağlantısı kişiye ya da firmaya yazılan temasta olur");
  if (oppId) {
    const o = requireRow(ctx, "opportunities", oppId);
    if (!sameSide(ctx, o.person_id, s)) throw new FFError("validation", `fırsat #${oppId} bu kişiye ya da firmasına ait değil`);
  } else if (s.person_id && !d.project_id) {
    // proje hakkındaki temas satış fırsatını ilerletmesin; sadece serbest temas tek açık fırsata bağlanır
    const open = rows<{ id: number }>(ctx, "SELECT id FROM opportunities WHERE person_id = ? AND stage IN ('bulundu','temas','cevap','gorusme','teklif')", s.person_id);
    if (open.length === 1) oppId = open[0].id;
  }
  if (d.project_id) {
    const p = requireRow(ctx, "projects", d.project_id);
    if (!sameSide(ctx, p.person_id, s)) throw new FFError("validation", `proje #${d.project_id} bu kişiye ya da firmasına ait değil`);
  }
  if (d.idea_id) requireRow(ctx, "ideas", d.idea_id);

  const r = q.insert(touches).values({
    ...s, opportunity_id: oppId, project_id: d.project_id ?? null,
    channel: d.channel, direction: d.direction, kind: d.kind, summary: d.summary, outcome: d.outcome ?? null,
    happened_at: d.happened_at ?? ctx.clock.now(),
    // giden mesaj varsayılan olarak cevap bekler (cevap bekleyenler listesi); arama/görüşme/gelen beklemez
    expects_reply: d.direction === "giden" && (d.expects_reply ?? d.kind === "mesaj"),
    draft_id: d.draft_id ?? null, idea_id: d.idea_id ?? null, ...stamp(ctx),
  }).returning().get();
  const who = s.person_id ? "" : s.company_id ? ` → ${requireRow(ctx, "companies", s.company_id).name}` : ` → ${s.contact}`;
  emit(q, ctx, {
    type: "touch.created", ...link(ctx, { person_id: s.person_id, opportunity_id: oppId, project_id: d.project_id }),
    summary: `${d.direction === "giden" ? "Giden" : "Gelen"} ${d.kind} (${d.channel})${who}: ${truncate(d.summary, 60)}`,
    data: { touch_id: r.id, channel: d.channel, direction: d.direction, company_id: s.company_id ?? undefined },
  });

  const effects: string[] = bumpStatus(ctx, s, statusOfTouch(d));
  // fikir hakkındaki temas: kişi fikre "anlatıldı" olarak bağlanır (zaten bağlıysa ilgisi değişmez)
  if (d.idea_id && s.person_id) effects.push(...upsertInterest(q, ctx, { idea_id: d.idea_id, person_id: s.person_id, touch_id: r.id }).effects);
  if (oppId) {
    const o = requireRow(ctx, "opportunities", oppId);
    const next = d.kind === "gorusme" && OPP_STAGES.indexOf(o.stage) < OPP_STAGES.indexOf("gorusme") ? "gorusme"
      : o.stage === "bulundu" && d.direction === "giden" ? "temas" : o.stage === "temas" && d.direction === "gelen" ? "cevap" : null;
    if (next) {
      applyStage(q, ctx, o, next, { auto: true });
      effects.push(`fırsat #${oppId} → ${next}`);
    }
  }
  return { row: r, effects };
}

export function touchesService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(touchCreate, input);
    return ctx.db.transaction((tx) => insertTouch(tx, ctx, d));
  }
  /** Özet, sonuç, kanal, tür, tarih ve cevap bekleme bayrağı düzeltilir; muhatap/fırsat/yön değişmez (aşama kuralı tekrar çalışmasın) */
  function update(id: number, input: unknown) {
    const d = parse(touchUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "touches", id);
      if (d.expects_reply && cur.direction !== "giden") throw new FFError("validation", "sadece giden temas cevap bekleyebilir");
      if (!Object.keys(d).length) return { row: cur, effects: [] as string[] };
      if (d.idea_id) {
        if (!cur.person_id) throw new FFError("validation", "fikir bağlantısı sadece kişiye yazılan temasta olur");
        requireRow(ctx, "ideas", d.idea_id);
      }
      tx.update(touches).set({ ...d, updated_at: ctx.clock.now() }).where(eq(touches.id, id)).run();
      const what = d.expects_reply === false ? "cevap beklenmiyor" : d.expects_reply ? "cevap bekleniyor" : "düzenlendi";
      emit(tx, ctx, { type: "touch.updated", ...link(ctx, cur), summary: `Temas ${what}: ${truncate(d.summary ?? cur.summary, 50)}`, data: { touch_id: id } });
      const effects = d.idea_id ? upsertInterest(tx, ctx, { idea_id: d.idea_id, person_id: cur.person_id, touch_id: id }).effects : [];
      if (d.kind) effects.push(...bumpStatus(ctx, cur, statusOfTouch({ direction: cur.direction, kind: d.kind })));
      return { row: requireRow(ctx, "touches", id), effects };
    });
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "touches", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.unlink("idea_people", "touch_id", id);
      bin.take("touches", "id = ?", id);
      bin.commit(tx, "touch", id, `Temas: ${truncate(cur.summary, 60)}`);
      emit(tx, ctx, { type: "touch.deleted", ...link(ctx, cur), summary: `Temas silindi: ${truncate(cur.summary, 60)}`, data: { touch_id: id } });
      return { effects: [] as string[], trash: { type: "touch", id } };
    });
  }
  return { create, update, remove };
}
