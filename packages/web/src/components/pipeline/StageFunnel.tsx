import { useMemo } from "react";
import type { Opportunity } from "../../api/types";
import { pct } from "../../lib/format";
import { OPEN_STAGES, STAGE, STAGE_BG, type OppStage } from "../../lib/labels";
import { shortLira } from "../../lib/pipeline";
import { BoardIcon } from "../boardIcons";
import { Card } from "../ui";

/** The last open stage has no rate: nothing comes after it in this funnel */
const LAST_STAGE = OPEN_STAGES[OPEN_STAGES.length - 1];

/** "Nerede kaybediyorsun": a bar per open stage with the rate to the next one; a click scrolls the board to that column */
export function StageFunnel({ rows, rates, onPick }: { rows: Opportunity[]; rates: Partial<Record<OppStage, number>>; onPick: (s: OppStage) => void }) {
  const stages = useMemo(() => {
    const by = new Map<OppStage, { n: number; v: number }>(OPEN_STAGES.map((s) => [s, { n: 0, v: 0 }]));
    for (const o of rows) {
      const e = by.get(o.stage);
      if (e) { e.n++; e.v += o.estimated_value ?? 0; }
    }
    return OPEN_STAGES.map((s) => ({ stage: s, ...by.get(s)! }));
  }, [rows]);
  const max = Math.max(1, ...stages.map((s) => s.n));
  const rated = stages.filter((s) => rates[s.stage] !== undefined && s.stage !== LAST_STAGE);
  const worst = rated.length > 1 ? rated.reduce((a, b) => (rates[b.stage]! < rates[a.stage]! ? b : a)).stage : null;

  return (
    <Card label="Huni" className="pipe-panel is-funnel rise">
      <div className="pipe-head">
        <h2 className="ff-card-title flex-grow">Nerede kaybediyorsun</h2>
        <span className="text-sm text-text-muted">Son 90 gün · aşamaya tıkla, panoda o sütuna gider</span>
      </div>
      <div className="pipe-funnel">
        {stages.map((s) => {
          const rate = s.stage === LAST_STAGE ? undefined : rates[s.stage];
          return (
            <button key={s.stage} type="button" className="pipe-stage" aria-label={`${STAGE[s.stage]}, ${s.n} fırsat`} onClick={() => onPick(s.stage)}>
              <span className="pipe-stage-top">
                <span className={`pipe-bar ${STAGE_BG[s.stage]}`} style={{ height: `max(var(--spacing-pipeline-bar-min), calc(var(--spacing-pipeline-funnel-h) * ${s.n / max}))` }}>{s.n}</span>
                <span className="pipe-rate">
                  {rate !== undefined ? (
                    <>
                      <span className={`pipe-rate-chip ${worst === s.stage ? "is-worst" : ""}`}>{pct(rate)}</span>
                      <BoardIcon name="arrowRight" className="size-icon-xs" stroke={2} />
                    </>
                  ) : null}
                </span>
              </span>
              <span className="pipe-stage-label">
                <span className="text-base-sm">{STAGE[s.stage]}</span>
                <span className="text-sm text-text-muted">{shortLira(s.v)}</span>
              </span>
            </button>
          );
        })}
      </div>
      {worst ? (
        <div className="pipe-callout">
          <span className="pipe-callout-dot" />
          <span>En çok {STAGE[worst]} aşamasında kaybediyorsun: sonraki aşamaya geçiş oranı {pct(rates[worst])}.</span>
        </div>
      ) : null}
    </Card>
  );
}
