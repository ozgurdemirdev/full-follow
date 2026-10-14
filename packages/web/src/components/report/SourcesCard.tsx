import type { SourceReport } from "../../api/types";
import { lira, pct } from "../../lib/format";
import { Card, order } from "../ui";
import { SectionHead } from "./SectionHead";

const rateTone = (r: SourceReport, best: SourceReport | undefined) => (r === best ? "success" : r.conversion == null ? "muted" : "info");
const BAR = { success: "bg-success", info: "bg-info", muted: "bg-entity-neutral" } as const;
const TEXT = { success: "text-success", info: "text-info", muted: "text-text-muted" } as const;

/** Conversion per lead source: opportunities, won, rate bar (the best source in green), won value; sources without opportunities are left out */
export function SourcesCard({ sources }: { sources: SourceReport[] }) {
  const rows = sources.filter((s) => s.total > 0);
  const best = rows.filter((s) => (s.conversion ?? 0) > 0).sort((a, b) => b.conversion! - a.conversion!)[0];
  return (
    <Card label="Kaynak bazında dönüşüm" className="rep-card rep-flush rise" style={order(4)}>
      <SectionHead title="Kaynak bazında dönüşüm" />
      <div className="rep-src is-head">
        <span>Kaynak</span><span>Fırsat</span><span>Kazanılan</span><span>Oran</span><span>Tutar</span>
      </div>
      {rows.map((r) => {
        const tone = rateTone(r, best);
        return (
          <div key={r.source_id} className="rep-src">
            <span>{r.source}</span>
            <span className="rep-num">{r.total}</span>
            <span className="rep-num">{r.won}</span>
            <span className="rep-rate">
              <span className="ff-meter" data-size="sm"><span className={`ff-meter-fill grow-x ${BAR[tone]}`} style={{ width: `${(r.conversion ?? 0) * 100}%` }} /></span>
              <span className={TEXT[tone]}>{pct(r.conversion)}</span>
            </span>
            <span className="rep-money">{lira(r.won_value)}</span>
          </div>
        );
      })}
      {rows.length === 0 ? <p className="rep-foot">Henüz kaynağı olan fırsat yok.</p> : null}
      <p className="rep-foot">Dönüşüm = kazanılan / kapanan (kazanılan + kaybedilen). Açık fırsatlar hesaba girmez.</p>
    </Card>
  );
}
