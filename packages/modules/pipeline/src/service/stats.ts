import {
  addDays, dayOf, keptRows, rows,
  type Ctx, type OpportunityFollowUp, type PersonPipelineStats, type SourceConversion,
} from "@fullfollow/core";
import { OPEN_SQL } from "./list";

/** Opportunity count per lead source */
export function countsBySource(ctx: Ctx): Map<number, number> {
  return new Map(keptRows<{ source_id: number; n: number }>(ctx, "SELECT source_id, COUNT(*) n FROM opportunities GROUP BY source_id").map((r) => [r.source_id, r.n]));
}

/** Open opportunities per company, through the company's people */
export function openCountsByCompany(ctx: Ctx): Map<number, number> {
  return new Map(keptRows<{ company_id: number; n: number }>(ctx, `SELECT p.company_id, COUNT(*) n FROM opportunities x JOIN people p ON p.id = x.person_id
    WHERE p.company_id IS NOT NULL AND x.stage IN (${OPEN_SQL}) GROUP BY p.company_id`).map((r) => [r.company_id, r.n]));
}

/** Per person: opportunities, won ones, the won value and the value still open */
export function personStats(ctx: Ctx): Map<number, PersonPipelineStats> {
  return new Map(keptRows<PersonPipelineStats & { person_id: number }>(ctx, `
    SELECT person_id, COUNT(*) AS opps, SUM(stage = 'kazanildi') AS won,
      COALESCE(SUM(CASE WHEN stage = 'kazanildi' THEN COALESCE(estimated_value, 0) END), 0) AS won_value,
      COALESCE(SUM(CASE WHEN stage IN (${OPEN_SQL}) THEN COALESCE(estimated_value, 0) END), 0) AS open_value
    FROM opportunities GROUP BY person_id`).map(({ person_id, ...stats }): [number, PersonPipelineStats] => [person_id, stats]));
}

/** Kaynak bazında dönüşüm: kazanılan / kapanan (kazanılan + kaybedilen). Açık fırsatlar paydaya girmez. */
export function bySource(ctx: Ctx): SourceConversion[] {
  return rows(ctx, `
    SELECT s.id AS source_id, s.name AS source,
      COUNT(o.id) AS total,
      COALESCE(SUM(o.stage = 'kazanildi'), 0) AS won,
      COALESCE(SUM(o.stage = 'kaybedildi'), 0) AS lost,
      COALESCE(SUM(o.stage NOT IN ('kazanildi','kaybedildi')), 0) AS open,
      COALESCE(SUM(CASE WHEN o.stage = 'kazanildi' THEN COALESCE(o.estimated_value, 0) END), 0) AS won_value
    FROM sources s LEFT JOIN opportunities o ON o.source_id = s.id
    GROUP BY s.id ORDER BY won DESC, total DESC, s.name`)
    .map((r) => ({ ...r, conversion: r.won + r.lost > 0 ? r.won / (r.won + r.lost) : null }));
}

/** Follow-up dates of open opportunities in the range (`done`: an outgoing touch on or after the date) */
export function followUpsDue(ctx: Ctx, from: string, to: string): OpportunityFollowUp[] {
  // TODO(modules): the touch check through ctx.mod("network") (raw table read for now)
  return rows<OpportunityFollowUp>(ctx, `SELECT 'opportunity' AS type, o.id, o.title AS name, substr(o.next_follow_up_at, 1, 10) AS date,
      EXISTS (SELECT 1 FROM touches t WHERE (t.opportunity_id = o.id OR t.person_id = o.person_id) AND t.direction = 'giden' AND substr(t.happened_at, 1, 10) >= substr(o.next_follow_up_at, 1, 10)) AS done
    FROM opportunities o WHERE o.stage IN (${OPEN_SQL}) AND substr(o.next_follow_up_at, 1, 10) BETWEEN ? AND ?`, from, to)
    .map((r) => ({ ...r, done: !!r.done }));
}

/** Opportunities that moved to the offer stage in from..to (counted from the stage events, so a later loss still counts) */
export function offersMade(ctx: Ctx, from: string, to: string): number {
  return rows<{ created_at: string }>(ctx, "SELECT created_at FROM events WHERE type = 'opp.stage' AND json_extract(data, '$.to') = 'teklif' AND created_at >= ?", addDays(from, -1))
    .filter((e) => { const d = dayOf(e.created_at); return d >= from && d <= to; }).length;
}

/** When each opportunity in the offer stage was last touched */
export const openOfferTimes = (ctx: Ctx): string[] =>
  keptRows<{ updated_at: string }>(ctx, "SELECT updated_at FROM opportunities WHERE stage = 'teklif'").map((r) => r.updated_at);

/** Creation times of the offers made since the date */
export const offerCreatedSince = (ctx: Ctx, since: string): string[] =>
  rows<{ created_at: string }>(ctx, "SELECT created_at FROM offers WHERE created_at >= ?", since).map((r) => r.created_at);
