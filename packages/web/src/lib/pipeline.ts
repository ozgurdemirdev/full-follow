// Pipeline screen logic: stage rules, forecast, age meter, funnel rates. Pure functions over the lists the page already loaded.
import type { Opportunity, SourceFunnel, Task, Thread } from "../api/types";
import { daysFrom, followNote, lira, todayIso } from "./format";
import { OPEN_STAGES, type OppStage } from "./labels";

/**
 * Win probability and stale limit (days) per open stage.
 * Gap G9: these constants move into packages/core/src/constants.ts with the pipeline module; until then the web owns them.
 */
export const STAGE_RULES: Record<string, { prob: number; staleDays: number }> = {
  bulundu: { prob: 0.05, staleDays: 14 },
  temas: { prob: 0.1, staleDays: 7 },
  cevap: { prob: 0.25, staleDays: 5 },
  gorusme: { prob: 0.45, staleDays: 10 },
  teklif: { prob: 0.65, staleDays: 7 },
};
/** The forecast is shown rounded to this step (TL) */
const FORECAST_STEP = 1000;
/** From this amount on a value is written short: "₺45B" for 45 thousand */
const SHORT_FROM = 1000;
const PERCENT = 100;
/** Sort key of a task without a due date: after every real date */
const NO_DUE = "9999-12-31";

export const isLive = (o: Pick<Opportunity, "stage">) => OPEN_STAGES.includes(o.stage);
/** Value written short in the funnel: ₺45B */
export const shortLira = (n: number) => (n >= SHORT_FROM ? `₺${Math.round(n / SHORT_FROM)}B` : lira(n));
export const probOf = (stage: OppStage) => STAGE_RULES[stage]?.prob ?? 0;
export const percentOf = (stage: OppStage) => `%${Math.round(probOf(stage) * PERCENT)}`;

/** Days an open opportunity has sat in its stage: `stage_since` when the API sends it, else the last change of the record */
export function ageDays(o: Opportunity, today = todayIso()): number {
  return Math.max(0, -daysFrom(o.stage_since ?? o.updated_at, today));
}
/** Share of the stage's stale limit used (0 to 100) and whether the card is past it */
export function ageMeter(o: Opportunity, today = todayIso()) {
  const limit = STAGE_RULES[o.stage]?.staleDays ?? 0;
  const days = ageDays(o, today);
  return { days, late: limit > 0 && days > limit, share: limit > 0 ? Math.min(PERCENT, Math.round((days / limit) * PERCENT)) : 0 };
}

export interface PipelineStats {
  open: number;
  openValue: number;
  weighted: number;
  wonValue: number;
  stale: number;
}
/** KPI row: open count and value, weighted forecast, won this month, stale count */
export function pipelineStats(rows: Opportunity[], today = todayIso()): PipelineStats {
  const month = today.slice(0, 7);
  const s: PipelineStats = { open: 0, openValue: 0, weighted: 0, wonValue: 0, stale: 0 };
  for (const o of rows) {
    const v = o.estimated_value ?? 0;
    if (isLive(o)) {
      s.open++;
      s.openValue += v;
      s.weighted += v * probOf(o.stage);
      if (ageMeter(o, today).late) s.stale++;
    } else if (o.stage === "kazanildi" && o.closed_at?.slice(0, 7) === month) s.wonValue += v;
  }
  s.weighted = Math.round(s.weighted / FORECAST_STEP) * FORECAST_STEP;
  return s;
}

/** Step of the source funnel that ends each stage column (the first stage has no entry: its rate is "written / found") */
const FUNNEL_AFTER: Record<string, [string, string]> = {
  bulundu: ["found", "written"], temas: ["written", "replied"], cevap: ["replied", "meeting"], gorusme: ["meeting", "offer"],
};
/**
 * Stage to stage rates of the last 90 days, from the lead source funnel summed over all sources
 * (people and companies by the day their record was made). Gap G9: `stage_rates` from core replaces this.
 */
export function stageRates(funnel: SourceFunnel | undefined): Partial<Record<OppStage, number>> {
  const out: Partial<Record<OppStage, number>> = {};
  if (!funnel) return out;
  const total = new Map<string, number>();
  for (const src of funnel.sources) for (const st of src.steps) total.set(st.key, (total.get(st.key) ?? 0) + st.count);
  for (const [stage, [from, to]] of Object.entries(FUNNEL_AFTER)) {
    const base = total.get(from) ?? 0;
    if (base) out[stage as OppStage] = (total.get(to) ?? 0) / base;
  }
  return out;
}

/** Hint of a card: the latest open Claude comment on the opportunity (threads are loaded once for the whole page) */
export function hintsByOpportunity(threads: Thread[]): Map<number, string> {
  const best = new Map<number, Thread>();
  for (const t of threads) {
    if (t.target_type !== "opportunity" || t.resolved_at || t.last_by !== "claude") continue;
    const cur = best.get(t.target_id);
    if (!cur || t.last_at > cur.last_at) best.set(t.target_id, t);
  }
  return new Map([...best].map(([id, t]) => [id, t.last_body]));
}

export interface LostRow {
  reason: string;
  count: number;
  value: number;
}
/** Lost reasons with count and value, the most frequent first */
export function lostReasons(rows: Opportunity[]): LostRow[] {
  const by = new Map<string, LostRow>();
  for (const o of rows) {
    if (o.stage !== "kaybedildi" || !o.lost_reason) continue;
    const r = by.get(o.lost_reason) ?? { reason: o.lost_reason, count: 0, value: 0 };
    r.count++;
    r.value += o.estimated_value ?? 0;
    by.set(o.lost_reason, r);
  }
  return [...by.values()].sort((a, b) => b.count - a.count || b.value - a.value);
}

/** The next step of each opportunity: its nearest open task, else the follow-up note (tasks are loaded once for the whole page) */
export function nextSteps(rows: Opportunity[], tasks: Task[]): Map<number, string> {
  const nearest = new Map<number, Task>();
  for (const t of tasks) {
    if (t.done_at || t.opportunity_id == null || t.assignee === "claude") continue;
    const cur = nearest.get(t.opportunity_id);
    if (!cur || (t.due_date ?? NO_DUE) < (cur.due_date ?? NO_DUE)) nearest.set(t.opportunity_id, t);
  }
  const out = new Map<number, string>();
  for (const o of rows) {
    const text = nearest.get(o.id)?.title ?? followNote(o.next_follow_up_at)?.text;
    if (text) out.set(o.id, text);
  }
  return out;
}

/** Quick reasons of the lost dialog; the first four are what the board offers */
export const LOST_PRESETS = ["Bütçe uymadı", "Başkasıyla anlaştı", "Cevap vermedi", "Zamanlama değil"];
/** Saved when the dialog is confirmed without a reason (the core requires some text) */
export const LOST_NO_REASON = "Neden yazılmadı";
