import { eq } from "drizzle-orm";
import { addDays } from "../dates";
import { emit, FFError, money, parse, row, stamp, type Ctx } from "../context";
import type { Q } from "../db/client";
import { opportunities, payments, projects } from "../db/schema";
import { label } from "../constants";
import { projectCreate, projectStageEnum, projectUpdate, stageMove } from "../schemas";
import { link, requireRow } from "./shared";
import { acceptedAmount } from "./offers";
import { readTemplate } from "./settings";
import { announceTrashed, Bin } from "./trash";

/** Şablondan ödeme planı üretir (zaten ödeme varsa ya da fiyat 0 ise üretmez). Üretilen sayıyı döner. */
export function planPayments(q: Q, ctx: Ctx, project: { id: number; price: number; started_at: string | null }): number {
  if (project.price <= 0) return 0;
  if (row(ctx, "SELECT COUNT(*) n FROM payments WHERE project_id = ?", project.id)?.n) return 0;
  const tpl = readTemplate(ctx);
  const base = project.started_at ?? ctx.clock.today();
  let allocated = 0;
  tpl.forEach((t, i) => {
    const last = i === tpl.length - 1;
    const amount = last ? project.price - allocated : Math.floor((project.price * t.percent) / 100);
    allocated += amount;
    q.insert(payments).values({
      project_id: project.id, milestone: t.milestone, expected_amount: amount,
      due_date: addDays(base, t.days), paid_amount: 0, ...stamp(ctx),
    }).run();
  });
  emit(q, ctx, {
    type: "payment.planned", ...link(ctx, { project_id: project.id }),
    summary: `Ödeme planı oluşturuldu: ${tpl.length} taksit, toplam ${money(project.price)}`,
  });
  return tpl.length;
}

/** Kazanılan fırsattan proje açar (fırsatın projesi yoksa); fiyat kabul edilen tekliften, yoksa fırsat değerinden */
export function createProjectFromOpportunity(q: Q, ctx: Ctx, opp: typeof opportunities.$inferSelect): { project: typeof projects.$inferSelect; planned: number } {
  const project = q.insert(projects).values({
    name: opp.title, opportunity_id: opp.id, person_id: opp.person_id, stage: "pesinat",
    price: acceptedAmount(ctx, opp.id) ?? opp.estimated_value ?? 0, started_at: ctx.clock.today(), ...stamp(ctx),
  }).returning().get();
  emit(q, ctx, { type: "project.created", ...link(ctx, { project_id: project.id }), summary: `Proje açıldı: ${project.name}` });
  return { project, planned: planPayments(q, ctx, project) };
}

function assertDepositPaid(ctx: Ctx, projectId: number) {
  const d = row(ctx, "SELECT COUNT(*) c, COALESCE(SUM(expected_amount),0) e, COALESCE(SUM(paid_amount),0) p FROM payments WHERE project_id = ? AND milestone = 'pesinat'", projectId);
  if (!d || d.c === 0 || d.e <= 0) {
    throw new FFError("rule", "Peşinat ödemesi planlanmamış; önce fiyatı gir ya da peşinat ödemesi ekle");
  }
  if (d.p < d.e) throw new FFError("rule", `Peşinat tam ödenmeden proje ilerleyemez (${money(d.p)}/${money(d.e)})`);
}

export function projectsService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(projectCreate, input);
    return ctx.db.transaction((tx) => {
      requireRow(ctx, "people", d.person_id);
      if (d.opportunity_id) {
        const opp = requireRow(ctx, "opportunities", d.opportunity_id);
        if (opp.person_id !== d.person_id) throw new FFError("validation", `fırsat #${d.opportunity_id} bu kişiye ait değil`);
        if (row(ctx, "SELECT 1 x FROM projects WHERE opportunity_id = ?", d.opportunity_id)) {
          throw new FFError("rule", "Bu fırsatın zaten bir projesi var");
        }
      }
      const r = tx.insert(projects).values({ ...d, started_at: d.started_at ?? ctx.clock.today(), stage: "pesinat", ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "project.created", ...link(ctx, { project_id: r.id }), summary: `Proje açıldı: ${r.name}` });
      const planned = planPayments(tx, ctx, r);
      return { row: r, effects: planned ? [`${planned} ödeme planlandı`] : [] };
    });
  }

  function update(id: number, input: unknown) {
    if (input && typeof input === "object" && "stage" in input) throw new FFError("rule", "Aşama için move kullan");
    const d = parse(projectUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "projects", id);
      if (Object.keys(d).length) tx.update(projects).set({ ...d, updated_at: ctx.clock.now() }).where(eq(projects.id, id)).run();
      const r = requireRow(ctx, "projects", id);
      const effects: string[] = [];
      if (d.price !== undefined && d.price !== cur.price) {
        const planned = planPayments(tx, ctx, r);
        if (planned) effects.push(`${planned} ödeme planlandı`);
        else if (row(ctx, "SELECT COUNT(*) n FROM payments WHERE project_id = ?", id)?.n) effects.push("fiyat değişti, mevcut ödeme planı güncellenmedi");
      }
      if (Object.keys(d).length) emit(tx, ctx, { type: "project.updated", ...link(ctx, { project_id: id }), summary: `Proje güncellendi (${Object.keys(d).join(", ")})` });
      return { row: r, effects };
    });
  }

  /** Aşama değiştirir. Peşinat tam ödenmeden pesinat'tan ileri geçilemez; geri alma ve iptal serbest. */
  function move(id: number, input: unknown) {
    const s = parse(stageMove, input);
    const stage = parse(projectStageEnum, s.stage);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "projects", id);
      if (stage === cur.stage) return { row: cur, effects: [] as string[] };
      if (stage !== "pesinat" && stage !== "iptal") assertDepositPaid(ctx, id);
      const set: Record<string, unknown> = { stage, updated_at: ctx.clock.now() };
      const effects: string[] = [];
      if (stage === "teslim" && !cur.delivered_at) {
        set.delivered_at = ctx.clock.today();
        effects.push("teslim tarihi bugün olarak yazıldı");
      }
      tx.update(projects).set(set).where(eq(projects.id, id)).run();
      emit(tx, ctx, {
        type: "project.stage", ...link(ctx, { project_id: id }),
        summary: `Proje ${label(cur.stage)} → ${label(stage)}`, data: { from: cur.stage, to: stage },
      });
      return { row: requireRow(ctx, "projects", id), effects };
    });
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "projects", id);
    const paid = row(ctx, "SELECT COALESCE(SUM(paid_amount),0) p FROM payments WHERE project_id = ?", id)?.p ?? 0;
    if (paid > 0) throw new FFError("rule", `${cur.name} silinemez: ${money(paid)} ödeme alınmış`);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.take("comments", "target_type = 'payment' AND target_id IN (SELECT id FROM payments WHERE project_id = ?)", id);
      bin.take("payments", "project_id = ?", id);
      bin.unlink("drafts", "project_id", id);
      // touches and tasks that point at it are the modules' to clean (network, calendar)
      announceTrashed(ctx, bin, "project", id);
      bin.take("comments", "target_type = 'project' AND target_id = ?", id);
      bin.take("files", "target_type = 'project' AND target_id = ?", id);
      bin.take("links", "target_type = 'project' AND target_id = ?", id);
      bin.take("projects", "id = ?", id);
      bin.commit(tx, "project", id, cur.name);
      emit(tx, ctx, { type: "project.deleted", ...link(ctx, { person_id: cur.person_id, opportunity_id: cur.opportunity_id }), summary: `Proje silindi: ${cur.name}` });
      return { effects: [] as string[], trash: { type: "project", id } };
    });
  }

  return { create, update, move, remove };
}
