import { useMemo } from "react";
import type { Opportunity, SourceReport } from "@kit/api/types";
import { pct } from "@kit/lib/format";
import { lostReasons, shortLira } from "../pipeline";
import { Card, Empty, Meter } from "@kit/components/ui";
import { m } from "../messages";

const PERCENT = 100;

/** "Neden kaybettin": the lost reasons with count and value, the most frequent first */
export function LostReasons({ rows }: { rows: Opportunity[] }) {
  const list = useMemo(() => lostReasons(rows), [rows]);
  const max = Math.max(1, ...list.map((r) => r.count));
  return (
    <Card title={m.breakdowns.lostTitle} className="pipe-panel rise">
      {list.length ? list.map((r) => (
        <div key={r.reason} className="pipe-reason">
          <div className="pipe-reason-head">
            <span className="text-text-neutral-chip">{r.reason}</span>
            <span className="font-mono text-text-secondary">{r.count} · {shortLira(r.value)}</span>
          </div>
          <Meter value={(r.count / max) * PERCENT} color="bg-danger" label={`${r.reason} ${r.count}`} />
        </div>
      )) : <Empty>{m.breakdowns.lostNone}</Empty>}
    </Card>
  );
}

/** "Fırsatlar nereden geliyor": opportunities per source with the win rate on the right */
export function SourceWins({ sources }: { sources: SourceReport[] }) {
  const list = useMemo(() => sources.filter((s) => s.total > 0).sort((a, b) => b.total - a.total), [sources]);
  const max = Math.max(1, ...list.map((s) => s.total));
  return (
    <Card title={m.breakdowns.sourcesTitle} className="pipe-panel rise">
      {list.length ? list.map((s) => (
        <div key={s.source_id} className="pipe-source">
          <span className="truncate text-text-neutral-chip">{s.source}</span>
          <Meter value={(s.total / max) * PERCENT} label={`${s.source} ${s.total}`} />
          <span className="text-right font-mono text-text-secondary">{s.total}{s.conversion != null ? ` · ${pct(s.conversion)}` : ""}</span>
        </div>
      )) : <Empty>{m.breakdowns.sourcesNone}</Empty>}
      <span className="pipe-note">{m.breakdowns.sourcesNote}</span>
    </Card>
  );
}
