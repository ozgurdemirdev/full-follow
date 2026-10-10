import { eq } from "drizzle-orm";
import { emit, FFError, parse, row, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { opportunities } from "../db/schema";
import { label, OPEN_OPP_STAGES, type OppStage } from "../constants";
import { oppCreate, oppStageEnum, oppUpdate, stageMove } from "../schemas";
import { addTagBySlug, checkSource } from "./categories";
import { createProjectFromOpportunity } from "./projects";
import { link, placeInGroup, requireRow } from "./shared";
import { Bin } from "./trash";

const isClosed = (s: string) => s === "kazanildi" || s === "kaybedildi";

/**
 * Aşamayı uygular (kanban sütun sırası, closed_at, lost_reason, olay). Kurallar (proje açma vb.) çağıranda.
 * move() ve temasın otomatik ilerletmesi kullanır.
 */
export function applyStage(q: Q, ctx: Ctx, cur: any, stage: OppStage, o: { reason?: string | null; position?: number; auto?: boolean } = {}) {
  const changed = stage !== cur.stage;
  const closed = isClosed(stage);
  const t = ctx.clock.now();
  q.update(opportunities).set({
    stage,
    closed_at: closed ? (changed || !cur.closed_at ? t : cur.closed_at) : null,
    lost_reason: stage === "kaybedildi" ? (o.reason ?? cur.lost_reason) : null,
    updated_at: t,
  }).where(eq(opportunities.id, cur.id)).run();

  // hedef sütunda sıra: araya ya da sona koy, sütunu yeniden numarala
  if (changed || o.position !== undefined) {
    placeInGroup(q, ctx, "opportunities", "stage = ?", [stage], cur.id, o.position);
  }
  if (changed) {
    emit(q, ctx, {
      type: "opp.stage", ...link(ctx, { opportunity_id: cur.id }),
      summary: `Fırsat ${label(cur.stage)} → ${label(stage)}${o.auto ? " (temastan)" : ""}`,
      data: { from: cur.stage, to: stage, reason: o.reason ?? undefined, auto: o.auto || undefined },
    });
  }
  return changed;
}

export function opportunitiesService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(oppCreate, input);
    return ctx.db.transaction((tx) => {
      requireRow(ctx, "people", d.person_id);
      checkSource(ctx, d.source_id);
      const pos = (row(ctx, "SELECT COALESCE(MAX(position), -1) + 1 p FROM opportunities WHERE stage = ?", d.stage)?.p ?? 0) as number;
      const r = tx.insert(opportunities).values({ ...d, position: pos, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "opp.created", ...link(ctx, { opportunity_id: r.id }), summary: `Fırsat açıldı: ${r.title}` });
      return { row: r, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    if (input && typeof input === "object" && ("stage" in input || "position" in input)) throw new FFError("rule", "Aşama için move kullan");
    const d = parse(oppUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "opportunities", id);
      if (d.person_id) requireRow(ctx, "people", d.person_id);
      if (d.source_id) checkSource(ctx, d.source_id, cur.source_id);
      if (Object.keys(d).length) {
        tx.update(opportunities).set({ ...d, updated_at: ctx.clock.now() }).where(eq(opportunities.id, id)).run();
        emit(tx, ctx, { type: "opp.updated", ...link(ctx, { opportunity_id: id }), summary: `Fırsat güncellendi (${Object.keys(d).join(", ")})` });
      }
      return { row: requireRow(ctx, "opportunities", id), effects: [] as string[] };
    });
  }

  /**
   * Aşama değiştirir (her yöne serbest). Kazanıldı: proje + ödeme planı + müşteri etiketi.
   * Kaybedildi: neden zorunlu.
   */
  function move(id: number, input: unknown) {
    const s = parse(stageMove, input);
    const stage = parse(oppStageEnum, s.stage);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "opportunities", id);
      const reason = s.reason ?? cur.lost_reason;
      if (stage === "kaybedildi" && !reason) throw new FFError("rule", "Kaybedildi için neden zorunlu");
      const changed = applyStage(tx, ctx, cur, stage, { reason, position: s.position });
      const effects: string[] = [];
      if (stage === "kazanildi" && changed) {
        if (row(ctx, "SELECT 1 x FROM projects WHERE opportunity_id = ?", id)) {
          effects.push("proje zaten var");
        } else {
          const { project, planned } = createProjectFromOpportunity(tx, ctx, { ...cur, stage });
          effects.push(`proje #${project.id} açıldı`);
          effects.push(planned ? `${planned} ödeme planlandı` : "fiyat girilmediği için ödeme planı yok");
        }
        if (addTagBySlug(tx, ctx, "person", cur.person_id, "musteri")) effects.push("müşteri etiketi eklendi");
      }
      return { row: requireRow(ctx, "opportunities", id), effects };
    });
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "opportunities", id);
    if (row(ctx, "SELECT 1 x FROM projects WHERE opportunity_id = ?", id)) throw new FFError("rule", `${cur.title} silinemez: projesi var`);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      for (const t of ["touches", "drafts", "tasks"]) bin.unlink(t, "opportunity_id", id);
      bin.take("comments", "target_type = 'opportunity' AND target_id = ?", id);
      bin.take("links", "target_type = 'opportunity' AND target_id = ?", id);
      bin.take("opportunities", "id = ?", id);
      bin.commit(tx, "opportunity", id, cur.title);
      emit(tx, ctx, { type: "opp.deleted", person_id: cur.person_id, summary: `Fırsat silindi: ${cur.title}` });
      return { effects: [] as string[], trash: { type: "opportunity", id } };
    });
  }

  return { create, update, move, remove, openStages: OPEN_OPP_STAGES };
}
