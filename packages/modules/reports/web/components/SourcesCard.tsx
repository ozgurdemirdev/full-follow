import type { SourceReport } from "@kit/api/types";
import { lira, pct } from "@kit/lib/format";
import { Card, order } from "@kit/components/ui";
import { SectionHead } from "@kit/components/SectionHead";
import { PERCENT } from "../constants";
import { m } from "../messages";

const rateTone = (r: SourceReport, best: SourceReport | undefined) => (r === best ? "success" : r.conversion == null ? "muted" : "info");
const BAR = { success: "bg-success", info: "bg-info", muted: "bg-entity-neutral" } as const;
const TEXT = { success: "text-success", info: "text-info", muted: "text-text-muted" } as const;

/** Conversion per lead source: opportunities, won, rate bar (the best source in green), won value; sources without opportunities are left out */
export function SourcesCard({ sources }: { sources: SourceReport[] }) {
  const rows = sources.filter((s) => s.total > 0);
  const best = rows.filter((s) => (s.conversion ?? 0) > 0).sort((a, b) => b.conversion! - a.conversion!)[0];
  return (
    <Card label={m.sources.title} className="rep-card rep-flush rise" style={order(4)}>
      <SectionHead title={m.sources.title} />
      <div className="rep-src is-head">
        <span>{m.sources.source}</span><span>{m.sources.opportunities}</span><span>{m.sources.won}</span><span>{m.sources.rate}</span><span>{m.sources.amount}</span>
      </div>
      {rows.map((r) => {
        const tone = rateTone(r, best);
        return (
          <div key={r.source_id} className="rep-src">
            <span>{r.source}</span>
            <span className="rep-num">{r.total}</span>
            <span className="rep-num">{r.won}</span>
            <span className="rep-rate">
              <span className="ff-meter" data-size="sm"><span className={`ff-meter-fill grow-x ${BAR[tone]}`} style={{ width: `${(r.conversion ?? 0) * PERCENT}%` }} /></span>
              <span className={TEXT[tone]}>{pct(r.conversion)}</span>
            </span>
            <span className="rep-money">{lira(r.won_value)}</span>
          </div>
        );
      })}
      {rows.length === 0 ? <p className="rep-foot">{m.sources.none}</p> : null}
      <p className="rep-foot">{m.sources.foot}</p>
    </Card>
  );
}
