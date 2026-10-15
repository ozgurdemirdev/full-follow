import { eq } from "drizzle-orm";
import {
  addDays, announceTrashed, Bin, eventLink as link, FFError, keptRow, label, money, parse, readTemplate, requireRow, row, schema, stamp, writeEvent as emit,
  type Ctx, type OfferPlanPart, type OpportunityWon, type Q,
} from "@fullfollow/core";
import { m } from "../messages";
import { projectCreate, projectStageEnum, projectUpdate, stageMove } from "./schemas";

const { payments, projects } = schema;
type Project = typeof projects.$inferSelect;

/**
 * Ödeme planı üretir (zaten ödeme varsa ya da fiyat 0 ise üretmez): kazanılan teklifin planından (yüzde yuvarlanır, kalan son taksitte),
 * teklifin planı yoksa ayarlardaki şablondan. Vade, şablondaki aynı aşamanın gününden gelir (şablonda yoksa vade boş). Üretilen sayıyı döner.
 */
export function planPayments(q: Q, ctx: Ctx, project: { id: number; price: number; started_at: string | null }, plan?: OfferPlanPart[] | null): number {
  if (project.price <= 0) return 0;
  if (row(ctx, "SELECT COUNT(*) n FROM payments WHERE project_id = ?", project.id)?.n) return 0;
  const tpl = readTemplate(ctx);
  const parts = plan ? plan.map((p) => ({ milestone: p.key, percent: p.pct, days: tpl.find((t) => t.milestone === p.key)?.days })) : tpl;
  const share = plan ? Math.round : Math.floor;
  const base = project.started_at ?? ctx.clock.today();
  let allocated = 0;
  parts.forEach((t, i) => {
    const last = i === parts.length - 1;
    const amount = last ? project.price - allocated : share((project.price * t.percent) / 100);
    allocated += amount;
    q.insert(payments).values({
      project_id: project.id, milestone: t.milestone, expected_amount: amount,
      due_date: t.days === undefined ? null : addDays(base, t.days), paid_amount: 0, ...stamp(ctx),
    }).run();
  });
  emit(q, ctx, {
    type: "payment.planned", ...link(ctx, { project_id: project.id }),
    summary: m.event.planCreated(parts.length, money(project.price), !!plan),
  });
  return parts.length;
}

/**
 * A won opportunity opens its project (the `opportunity.won` event of the pipeline module): the price comes with the event
 * (accepted offer, else the estimate), the payment plan from the template. An opportunity that already has a project gets none. Returns the effects.
 */
export function openProjectForWonOpportunity(q: Q, ctx: Ctx, won: OpportunityWon): string[] {
  if (keptRow(ctx, "SELECT 1 x FROM projects WHERE opportunity_id = ?", won.opportunity.id)) return [m.effect.projectExists];
  const project = q.insert(projects).values({
    name: won.opportunity.title, opportunity_id: won.opportunity.id, person_id: won.opportunity.person_id, stage: "pesinat",
    price: won.price, started_at: ctx.clock.today(), ...stamp(ctx),
  }).returning().get();
  emit(q, ctx, { type: "project.created", ...link(ctx, { project_id: project.id }), summary: m.event.projectOpened(project.name) });
  const planned = planPayments(q, ctx, project, won.offer?.plan);
  return [m.effect.projectOpened(project.id), planned ? m.effect.planned(planned) : m.effect.noPlan];
}

function assertDepositPaid(ctx: Ctx, projectId: number) {
  const d = row(ctx, "SELECT COUNT(*) c, COALESCE(SUM(expected_amount),0) e, COALESCE(SUM(paid_amount),0) p FROM payments WHERE project_id = ? AND milestone = 'pesinat'", projectId);
  if (!d || d.c === 0 || d.e <= 0) {
    throw new FFError("rule", m.error.noDeposit);
  }
  if (d.p < d.e) throw new FFError("rule", m.error.depositUnpaid(money(d.p), money(d.e)));
}

export function projectsService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(projectCreate, input);
    return ctx.db.transaction((tx) => {
      requireRow(ctx, "people", d.person_id);
      if (d.opportunity_id) {
        const pipeline = ctx.mod("pipeline");
        if (!pipeline) throw new FFError("validation", m.error.opportunityModuleMissing(d.opportunity_id));
        const opp = pipeline.opportunities.ref(d.opportunity_id);
        if (!opp) throw new FFError("not_found", m.error.opportunityNotFound(d.opportunity_id));
        if (opp.person_id !== d.person_id) throw new FFError("validation", m.error.opportunityNotTheirs(d.opportunity_id));
        if (keptRow(ctx, "SELECT 1 x FROM projects WHERE opportunity_id = ?", d.opportunity_id)) {
          throw new FFError("rule", m.error.opportunityHasProject);
        }
      }
      // a project created at a later stage is a job already under way: the deposit rule guards the moves after it, not the start
      const stage = d.stage ?? "pesinat";
      const r = tx.insert(projects).values({
        ...d, started_at: d.started_at ?? ctx.clock.today(), stage, delivered_at: stage === "teslim" ? ctx.clock.today() : null, ...stamp(ctx),
      }).returning().get();
      emit(tx, ctx, { type: "project.created", ...link(ctx, { project_id: r.id }), summary: m.event.projectOpened(r.name) });
      const planned = planPayments(tx, ctx, r);
      return { row: r, effects: planned ? [m.effect.planned(planned)] : [] };
    });
  }

  function update(id: number, input: unknown) {
    if (input && typeof input === "object" && "stage" in input) throw new FFError("rule", m.error.useMove);
    const d = parse(projectUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow<Project>(ctx, "projects", id);
      if (Object.keys(d).length) tx.update(projects).set({ ...d, updated_at: ctx.clock.now() }).where(eq(projects.id, id)).run();
      const r = requireRow<Project>(ctx, "projects", id);
      const effects: string[] = [];
      if (d.price !== undefined && d.price !== cur.price) {
        const planned = planPayments(tx, ctx, r);
        if (planned) effects.push(m.effect.planned(planned));
        else if (row(ctx, "SELECT COUNT(*) n FROM payments WHERE project_id = ?", id)?.n) effects.push(m.effect.planStale);
      }
      if (Object.keys(d).length) emit(tx, ctx, { type: "project.updated", ...link(ctx, { project_id: id }), summary: m.event.projectUpdated(Object.keys(d).join(", ")) });
      return { row: r, effects };
    });
  }

  /** Aşama değiştirir. Peşinat tam ödenmeden pesinat'tan ileri geçilemez; geri alma ve iptal serbest. */
  function move(id: number, input: unknown) {
    const s = parse(stageMove, input);
    const stage = parse(projectStageEnum, s.stage);
    return ctx.db.transaction((tx) => {
      const cur = requireRow<Project>(ctx, "projects", id);
      if (stage === cur.stage) return { row: cur, effects: [] as string[] };
      if (stage !== "pesinat" && stage !== "iptal") assertDepositPaid(ctx, id);
      const set: Record<string, unknown> = { stage, updated_at: ctx.clock.now() };
      const effects: string[] = [];
      if (stage === "teslim" && !cur.delivered_at) {
        set.delivered_at = ctx.clock.today();
        effects.push(m.effect.deliveredToday);
      }
      tx.update(projects).set(set).where(eq(projects.id, id)).run();
      emit(tx, ctx, {
        type: "project.stage", ...link(ctx, { project_id: id }),
        summary: m.event.projectStage(label(cur.stage), label(stage)), data: { from: cur.stage, to: stage },
      });
      return { row: requireRow<Project>(ctx, "projects", id), effects };
    });
  }

  function remove(id: number) {
    const cur = requireRow<Project>(ctx, "projects", id);
    const paid = row(ctx, "SELECT COALESCE(SUM(paid_amount),0) p FROM payments WHERE project_id = ?", id)?.p ?? 0;
    if (paid > 0) throw new FFError("rule", m.error.projectCannotDelete(cur.name, money(paid)));
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.take("comments", "target_type = 'payment' AND target_id IN (SELECT id FROM payments WHERE project_id = ?)", id);
      bin.take("payments", "project_id = ?", id);
      // touches, tasks and drafts that point at it are the owning modules' to clean
      announceTrashed(ctx, bin, "project", id);
      bin.take("comments", "target_type = 'project' AND target_id = ?", id);
      bin.take("files", "target_type = 'project' AND target_id = ?", id);
      bin.take("links", "target_type = 'project' AND target_id = ?", id);
      bin.take("projects", "id = ?", id);
      bin.commit(tx, "project", id, cur.name);
      emit(tx, ctx, { type: "project.deleted", ...link(ctx, { person_id: cur.person_id, opportunity_id: cur.opportunity_id }), summary: m.event.projectDeleted(cur.name) });
      return { effects: [] as string[], trash: { type: "project", id } };
    });
  }

  return { create, update, move, remove };
}
