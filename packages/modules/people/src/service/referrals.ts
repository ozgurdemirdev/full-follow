import { OPEN_OPP_STAGES, rows, type Ctx, type ReferralValue } from "@fullfollow/core";

const OPEN = OPEN_OPP_STAGES.map((s) => `'${s}'`).join(",");

/**
 * Referans değeri: her tanıtan için alt ağaçtaki kişilerden gelen fırsat ve iş.
 * TODO(modules): opportunities, projects and payments through ctx.mod("pipeline") / ctx.mod("projects") when the referrals module takes this over (raw table reads for now)
 */
export function referralValues(ctx: Ctx): ReferralValue[] {
  const people = rows<{ id: number; name: string; referred_by_id: number | null; company_name: string | null }>(ctx,
    "SELECT p.id, p.name, p.referred_by_id, c.name AS company_name FROM people p LEFT JOIN companies c ON c.id = p.company_id");
  const opp = new Map(rows(ctx, `
    SELECT person_id, COUNT(*) AS opps, SUM(stage = 'kazanildi') AS won,
      COALESCE(SUM(CASE WHEN stage = 'kazanildi' THEN COALESCE(estimated_value, 0) END), 0) AS won_value,
      COALESCE(SUM(CASE WHEN stage IN (${OPEN}) THEN COALESCE(estimated_value, 0) END), 0) AS open_value
    FROM opportunities GROUP BY person_id`).map((r) => [r.person_id as number, r]));
  const work = new Map(rows(ctx, `
    SELECT pr.person_id, COUNT(DISTINCT pr.id) AS projects, COALESCE(SUM(pa.paid_amount), 0) AS collected
    FROM projects pr LEFT JOIN payments pa ON pa.project_id = pr.id GROUP BY pr.person_id`).map((r) => [r.person_id as number, r]));
  const kids = new Map<number, number[]>();
  for (const p of people) if (p.referred_by_id) kids.set(p.referred_by_id, [...(kids.get(p.referred_by_id) ?? []), p.id]);

  const result: ReferralValue[] = [];
  for (const p of people) {
    const direct = kids.get(p.id) ?? [];
    if (!direct.length) continue;
    const v = { opps: 0, won: 0, won_value: 0, open_value: 0, projects: 0, collected: 0 };
    const seen = new Set<number>([p.id]);
    const stack = [...direct];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const o = opp.get(id);
      const w = work.get(id);
      if (o) { v.opps += o.opps; v.won += o.won; v.won_value += o.won_value; v.open_value += o.open_value; }
      if (w) { v.projects += w.projects; v.collected += w.collected; }
      stack.push(...(kids.get(id) ?? []));
    }
    result.push({ person_id: p.id, name: p.name, company_name: p.company_name, direct: direct.length, network: seen.size - 1, ...v });
  }
  return result.sort((a, b) => b.won_value - a.won_value || b.collected - a.collected || b.opps - a.opps || b.network - a.network || a.name.localeCompare(b.name, "tr"));
}
