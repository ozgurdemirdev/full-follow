import { eq } from "drizzle-orm";
import {
  addTagBySlug, announceTrashed, Bin, checkSource, eventLink as link, FFError, keptRow, label, OPEN_OPP_STAGES, parse, placeInGroup, requireRow, resolveRef, row, schema, stamp,
  writeEvent as emit, type Ctx, type OpportunityWon, type OppStage, type Q,
} from "@fullfollow/core";
import { oppCreate, oppStageEnum, oppUpdate, stageMove } from "./schemas";
import { dropMember, upsertMember } from "./team";

const { opportunities } = schema;
type Opp = typeof opportunities.$inferSelect;

const isClosed = (s: string) => s === "kazanildi" || s === "kaybedildi";

/**
 * Aşamayı uygular (kanban sütun sırası, closed_at, lost_reason, olay). Kurallar (proje açma vb.) çağıranda.
 * move() ve temasın otomatik ilerletmesi kullanır.
 */
export function applyStage(q: Q, ctx: Ctx, cur: Opp, stage: OppStage, o: { reason?: string | null; position?: number; auto?: boolean } = {}) {
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

/** What the projects module needs to open a project from a won opportunity: plain data, the accepted offer and the price included */
function wonPayload(ctx: Ctx, opp: Opp): OpportunityWon {
  const offer = keptRow<{ id: number; amount: number; items: string }>(ctx, "SELECT id, amount, items FROM offers WHERE opportunity_id = ? AND accepted_at IS NOT NULL", opp.id);
  const companyId = keptRow<{ company_id: number | null }>(ctx, "SELECT company_id FROM people WHERE id = ?", opp.person_id)?.company_id ?? null;
  return {
    opportunity: { id: opp.id, title: opp.title, person_id: opp.person_id, company_id: companyId, estimated_value: opp.estimated_value },
    offer: offer ? { id: offer.id, amount: offer.amount, items: JSON.parse(offer.items) } : null,
    price: offer?.amount ?? opp.estimated_value ?? 0,
  };
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
    const { add_people, remove_people, ...d } = parse(oppUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow<Opp>(ctx, "opportunities", id);
      if (d.person_id) requireRow(ctx, "people", d.person_id);
      if (d.source_id) checkSource(ctx, d.source_id, cur.source_id);
      if (Object.keys(d).length) {
        tx.update(opportunities).set({ ...d, updated_at: ctx.clock.now() }).where(eq(opportunities.id, id)).run();
        emit(tx, ctx, { type: "opp.updated", ...link(ctx, { opportunity_id: id }), summary: `Fırsat güncellendi (${Object.keys(d).join(", ")})` });
      }
      // team changes (the main contact may have just changed, so read the row again)
      const now = requireRow<Opp>(ctx, "opportunities", id);
      const effects = [
        ...(remove_people ?? []).map((p) => dropMember(tx, ctx, now, resolveRef(ctx, "person", p))),
        ...(add_people ?? []).map((m) => upsertMember(tx, ctx, now, resolveRef(ctx, "person", m.person), m.role, m.note)),
      ];
      return { row: now, effects };
    });
  }

  /**
   * Aşama değiştirir (her yöne serbest). Kaybedildi: neden zorunlu.
   * Won: emits `opportunity.won` (the projects module opens the project and its payment plan) and tags the person as a customer.
   */
  function move(id: number, input: unknown) {
    const s = parse(stageMove, input);
    const stage = parse(oppStageEnum, s.stage);
    return ctx.db.transaction((tx) => {
      const cur = requireRow<Opp>(ctx, "opportunities", id);
      const reason = s.reason ?? cur.lost_reason;
      if (stage === "kaybedildi" && !reason) throw new FFError("rule", "Kaybedildi için neden zorunlu");
      const changed = applyStage(tx, ctx, cur, stage, { reason, position: s.position });
      const effects: string[] = [];
      if (stage === "kazanildi" && changed) {
        effects.push(...ctx.emit("opportunity.won", wonPayload(ctx, cur)));
        if (addTagBySlug(tx, ctx, "person", cur.person_id, "musteri")) effects.push("müşteri etiketi eklendi");
      }
      return { row: requireRow<Opp>(ctx, "opportunities", id), effects };
    });
  }

  function remove(id: number) {
    const cur = requireRow<Opp>(ctx, "opportunities", id);
    if (ctx.mod("projects")?.projects.forOpportunity(id)) throw new FFError("rule", `${cur.title} silinemez: projesi var`);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      // touches, tasks and drafts that point at it are the owning modules' to clean
      announceTrashed(ctx, bin, "opportunity", id);
      // offers point at files, so they go first
      bin.take("offers", "opportunity_id = ?", id);
      bin.take("files", "target_type = 'opportunity' AND target_id = ?", id);
      bin.take("opportunity_people", "opportunity_id = ?", id);
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
