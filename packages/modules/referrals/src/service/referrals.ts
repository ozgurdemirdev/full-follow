import { LOCALE, type Ctx, type PersonPipelineStats, type PersonProjectStats, type ReferralValue } from "@fullfollow/core";

/**
 * Referans değeri: her tanıtan için alt ağaçtaki kişilerden gelen fırsat ve iş.
 * The tree comes from the people module (nobody is introduced without it); the opportunity and project numbers come from the pipeline and projects modules (zero without them).
 */
export function referralValues(ctx: Ctx): ReferralValue[] {
  const people = ctx.mod("people")?.referralTree() ?? [];
  const opp: Map<number, PersonPipelineStats> = ctx.mod("pipeline")?.personStats() ?? new Map();
  const work: Map<number, PersonProjectStats> = ctx.mod("projects")?.personStats() ?? new Map();
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
  return result.sort((a, b) => b.won_value - a.won_value || b.collected - a.collected || b.opps - a.opps || b.network - a.network || a.name.localeCompare(b.name, LOCALE));
}
