import { addDays, keptRows, OPEN_OPP_STAGES, OPP_STAGES, type Ctx, type OppStage, type PipelineMeta, type StageRate, type StageRule } from "@fullfollow/core";

/** Per open stage: the days after which an opportunity there counts as stale (the board's age meter) */
export const STAGE_RULES: readonly StageRule[] = [
  { stage: "bulundu", stale_days: 14 },
  { stage: "temas", stale_days: 7 },
  { stage: "cevap", stale_days: 5 },
  { stage: "gorusme", stale_days: 10 },
  { stage: "teklif", stale_days: 7 },
];

/** The stage to stage rates look at this many days of stage changes */
export const STAGE_RATE_DAYS = 90;
/** A move to this stage is never a step forward, whatever its place in the stage order */
const LOST: OppStage = "kaybedildi";

/**
 * For each open stage, of the opportunities that left it in the last STAGE_RATE_DAYS days (from the stage change events),
 * the share that moved forward: to a later stage or to won; a loss or a step back is not forward. null while none left the stage.
 * One grouped query over the events.
 */
export function stageRates(ctx: Ctx): StageRate[] {
  const moves = keptRows<{ from_stage: OppStage; to_stage: OppStage; n: number }>(ctx, `
    SELECT json_extract(data, '$.from') AS from_stage, json_extract(data, '$.to') AS to_stage, COUNT(*) AS n
    FROM events WHERE type = 'opp.stage' AND created_at >= ? GROUP BY from_stage, to_stage`, addDays(ctx.clock.today(), -STAGE_RATE_DAYS));
  return OPEN_OPP_STAGES.map((stage) => {
    const left = moves.filter((m) => m.from_stage === stage);
    const total = left.reduce((a, m) => a + m.n, 0);
    const forward = left.filter((m) => m.to_stage !== LOST && OPP_STAGES.indexOf(m.to_stage) > OPP_STAGES.indexOf(stage)).reduce((a, m) => a + m.n, 0);
    return { stage, to_next: total ? forward / total : null };
  });
}

export const pipelineMeta = (ctx: Ctx): PipelineMeta => ({ stages: [...STAGE_RULES], stage_rates: stageRates(ctx) });
