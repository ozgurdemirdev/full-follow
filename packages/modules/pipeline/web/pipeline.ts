// Pipeline screen logic: forecast, age meter, funnel rates. Pure functions over the lists the page already loaded;
// the stage rules (win probability, stale days) and the stage to stage rates come from core with the opportunity list.
import { createContext, useContext } from "react";
import type { Opportunity, PipelineMeta, Task, Thread } from "@kit/api/types";
import { daysFrom, followNote, lira, todayIso } from "@kit/lib/format";
import { OPEN_STAGES, type OppStage } from "@kit/lib/labels";

/** Win probability (0 to 1) and stale limit (days) per open stage */
export type StageRules = ReadonlyMap<string, { prob: number; staleDays: number }>;
export const stageRulesOf = (meta: PipelineMeta | undefined): StageRules =>
  new Map((meta?.stages ?? []).map((s) => [s.stage, { prob: s.probability, staleDays: s.stale_days }]));
/** The page provides the rules it loaded; the cards and columns read them */
const RulesContext = createContext<StageRules>(new Map());
export const StageRulesProvider = RulesContext.Provider;
export const useStageRules = () => useContext(RulesContext);

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
export const probOf = (stage: OppStage, rules: StageRules) => rules.get(stage)?.prob ?? 0;
export const percentOf = (stage: OppStage, rules: StageRules) => `%${Math.round(probOf(stage, rules) * PERCENT)}`;

/** Days an open opportunity has sat in its stage, from `stage_since` */
export function ageDays(o: Opportunity, today = todayIso()): number {
  return Math.max(0, -daysFrom(o.stage_since ?? o.updated_at, today));
}
/** Share of the stage's stale limit used (0 to 100) and whether the card is past it */
export function ageMeter(o: Opportunity, rules: StageRules, today = todayIso()) {
  const limit = rules.get(o.stage)?.staleDays ?? 0;
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
export function pipelineStats(rows: Opportunity[], rules: StageRules, today = todayIso()): PipelineStats {
  const month = today.slice(0, 7);
  const s: PipelineStats = { open: 0, openValue: 0, weighted: 0, wonValue: 0, stale: 0 };
  for (const o of rows) {
    const v = o.estimated_value ?? 0;
    if (isLive(o)) {
      s.open++;
      s.openValue += v;
      s.weighted += v * probOf(o.stage, rules);
      if (ageMeter(o, rules, today).late) s.stale++;
    } else if (o.stage === "kazanildi" && o.closed_at?.slice(0, 7) === month) s.wonValue += v;
  }
  s.weighted = Math.round(s.weighted / FORECAST_STEP) * FORECAST_STEP;
  return s;
}

/** Stage to stage rates of the last 90 days, as core counts them from the stage change events (a stage nothing left has none) */
export function stageRates(meta: PipelineMeta | undefined): Partial<Record<OppStage, number>> {
  const out: Partial<Record<OppStage, number>> = {};
  for (const r of meta?.stage_rates ?? []) if (r.to_next !== null) out[r.stage] = r.to_next;
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
