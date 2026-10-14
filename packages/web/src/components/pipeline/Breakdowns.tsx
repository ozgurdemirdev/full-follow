import { useMemo } from "react";
import type { Opportunity, SourceReport } from "../../api/types";
import { pct } from "../../lib/format";
import { lostReasons, shortLira } from "../../lib/pipeline";
import { Card, Empty, Meter } from "../ui";

const PERCENT = 100;

/** "Neden kaybettin": the lost reasons with count and value, the most frequent first */
export function LostReasons({ rows }: { rows: Opportunity[] }) {
  const list = useMemo(() => lostReasons(rows), [rows]);
  const max = Math.max(1, ...list.map((r) => r.count));
  return (
    <Card title="Neden kaybettin" className="pipe-panel rise">
      {list.length ? list.map((r) => (
        <div key={r.reason} className="pipe-reason">
          <div className="pipe-reason-head">
            <span className="text-text-neutral-chip">{r.reason}</span>
            <span className="font-mono text-text-secondary">{r.count} · {shortLira(r.value)}</span>
          </div>
          <Meter value={(r.count / max) * PERCENT} color="bg-danger" label={`${r.reason} ${r.count}`} />
        </div>
      )) : <Empty>Henüz kaybedilen fırsat yok.</Empty>}
    </Card>
  );
}

/** "Fırsatlar nereden geliyor": opportunities per source with the win rate on the right */
export function SourceWins({ sources }: { sources: SourceReport[] }) {
  const list = useMemo(() => sources.filter((s) => s.total > 0).sort((a, b) => b.total - a.total), [sources]);
  const max = Math.max(1, ...list.map((s) => s.total));
  return (
    <Card title="Fırsatlar nereden geliyor" className="pipe-panel rise">
      {list.length ? list.map((s) => (
        <div key={s.source_id} className="pipe-source">
          <span className="truncate text-text-neutral-chip">{s.source}</span>
          <Meter value={(s.total / max) * PERCENT} label={`${s.source} ${s.total}`} />
          <span className="text-right font-mono text-text-secondary">{s.total}{s.conversion != null ? ` · ${pct(s.conversion)}` : ""}</span>
        </div>
      )) : <Empty>Henüz kaynağı olan fırsat yok.</Empty>}
      <span className="pipe-note">Sağdaki oran kazanma oranı.</span>
    </Card>
  );
}
