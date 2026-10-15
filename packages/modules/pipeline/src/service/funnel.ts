import {
  addDays, FFError, LOCALE, OFFER_STAGES, RATE_MIN_SAMPLE, REPLIED_AFTER, rows, SOURCE_FUNNEL_DEFAULT_PERIOD, SOURCE_FUNNEL_PERIODS, SOURCE_FUNNEL_STEPS, SOURCE_WEAK_SHARE,
  type Ctx, type ContactStatus, type SourceFunnel,
} from "@fullfollow/core";
import { m } from "../messages";

export type FunnelPeriod = (typeof SOURCE_FUNNEL_PERIODS)[number];
export type FunnelStep = (typeof SOURCE_FUNNEL_STEPS)[number];

/** Contact status that means the first meeting happened (status.ts sets it from a call or meeting touch) */
const MET: ContactStatus = "gorusuldu";

export function parseFunnelPeriod(v: unknown): FunnelPeriod {
  if (v === undefined || v === null || v === "") return SOURCE_FUNNEL_DEFAULT_PERIOD;
  const p = SOURCE_FUNNEL_PERIODS.find((x) => String(x) === String(v));
  if (p === undefined) throw new FFError("validation", m.error.period(SOURCE_FUNNEL_PERIODS.join(", ")));
  return p;
}

/**
 * Per record kind: how its touches and opportunities are matched.
 * Reads the touches, people and companies tables directly on purpose: tables always exist, so the funnel keeps working without those modules, and one query per kind keeps it cheap. A company counts its own touches and its people's,
 * the same way status.ts moves a company's status when one of its people is written to.
 */
const KIND = {
  person: { table: "people", touch: "x.person_id = r.id", opp: "o.person_id = r.id" },
  company: {
    table: "companies",
    touch: "(x.company_id = r.id OR x.person_id IN (SELECT id FROM people WHERE company_id = r.id))",
    opp: "o.person_id IN (SELECT id FROM people WHERE company_id = r.id)",
  },
} as const;

const OFFERED = `(o.stage IN (${OFFER_STAGES.map((s) => `'${s}'`).join(",")})
  OR EXISTS (SELECT 1 FROM events e WHERE e.opportunity_id = o.id AND e.type = 'opp.stage' AND json_extract(e.data, '$.to') = 'teklif'))`;

type Flags = Record<Exclude<FunnelStep, "found">, number>;

/** One row per person or company that has a source; the flags are SQL booleans (the reply rule is the template one) */
function recordFlags(ctx: Ctx, kind: keyof typeof KIND, since: string | null) {
  const k = KIND[kind];
  return rows<Flags & { source_id: number }>(ctx, `
    SELECT r.source_id,
      EXISTS (SELECT 1 FROM touches x WHERE ${k.touch} AND x.direction = 'giden') AS written,
      EXISTS (SELECT 1 FROM touches x WHERE ${k.touch} AND x.direction = 'giden' AND ${REPLIED_AFTER}) AS replied,
      (r.contact_status = '${MET}' OR EXISTS (SELECT 1 FROM touches x WHERE ${k.touch} AND x.kind = 'gorusme')) AS meeting,
      EXISTS (SELECT 1 FROM opportunities o WHERE ${k.opp} AND ${OFFERED}) AS offer,
      EXISTS (SELECT 1 FROM opportunities o WHERE ${k.opp} AND o.stage = 'kazanildi') AS won
    FROM ${k.table} r WHERE r.source_id IS NOT NULL AND (? IS NULL OR substr(r.created_at, 1, 10) >= ?)`, since, since);
}

/**
 * Lead source funnel: per source, people and companies found there and how far they got (written, replied, meeting,
 * offer, won). A later step implies the earlier ones, so counts never grow along the funnel. Each step has its rate
 * against the previous one. `reply_rate` = replied / written; `early`: fewer than RATE_MIN_SAMPLE written, the rate is
 * too noisy to rank. `weak`: among sources with enough sample, the lowest SOURCE_WEAK_SHARE by reply rate (at least one
 * source must be better than it).
 */
export function sourceFunnel(ctx: Ctx, period: unknown = SOURCE_FUNNEL_DEFAULT_PERIOD): SourceFunnel {
  const p = parseFunnelPeriod(period);
  const since = p === "all" ? null : addDays(ctx.clock.today(), -p);
  const counts = new Map<number, number[]>();
  for (const kind of Object.keys(KIND) as (keyof typeof KIND)[]) {
    for (const f of recordFlags(ctx, kind, since)) {
      const reached = [true, ...(SOURCE_FUNNEL_STEPS.slice(1) as Exclude<FunnelStep, "found">[]).map((s) => !!f[s])];
      for (let i = reached.length - 2; i >= 0; i--) reached[i] ||= reached[i + 1];
      const c = counts.get(f.source_id) ?? SOURCE_FUNNEL_STEPS.map(() => 0);
      reached.forEach((r, i) => { if (r) c[i]++; });
      counts.set(f.source_id, c);
    }
  }
  const names = new Map(rows<{ id: number; name: string }>(ctx, "SELECT id, name FROM sources").map((s) => [s.id, s.name]));
  const list = [...counts].map(([source_id, c]) => {
    const [, written, replied] = c;
    return {
      source_id, source: names.get(source_id) ?? `#${source_id}`,
      steps: SOURCE_FUNNEL_STEPS.map((key, i) => ({ key, count: c[i], rate: i && c[i - 1] ? c[i] / c[i - 1] : null })),
      reply_rate: written ? replied / written : null,
      early: written < RATE_MIN_SAMPLE, weak: false,
    };
  }).sort((a, b) => b.steps[0].count - a.steps[0].count || a.source.localeCompare(b.source, LOCALE));

  const ranked = list.filter((s) => !s.early).sort((a, b) => a.reply_rate! - b.reply_rate!);
  const best = ranked.at(-1)?.reply_rate ?? 0;
  for (const s of ranked.slice(0, Math.floor(ranked.length * SOURCE_WEAK_SHARE))) s.weak = s.reply_rate! < best;
  return { period: p, since, sources: list };
}
