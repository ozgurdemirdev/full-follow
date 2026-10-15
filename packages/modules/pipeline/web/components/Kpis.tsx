import { lira } from "@kit/lib/format";
import type { PipelineStats } from "../pipeline";
import { Card } from "@kit/components/ui";
import { m } from "../messages";

/** The four numbers on top: open value, weighted forecast, won this month against the monthly floor, stale count */
export function Kpis({ stats, floor }: { stats: PipelineStats; floor: number }) {
  const items = [
    { n: m.kpi.open, v: lira(stats.openValue), s: m.kpi.openSub(stats.open), c: "text-text-primary" },
    { n: m.kpi.weighted, v: lira(stats.weighted), s: m.kpi.weightedSub, c: "text-accent" },
    { n: m.kpi.won, v: lira(stats.wonValue), s: floor ? m.kpi.wonFloor(lira(floor)) : m.kpi.wonClosing, c: "text-text-primary" },
    { n: m.kpi.stale, v: String(stats.stale), s: m.kpi.staleSub, c: stats.stale ? "text-warning" : "text-success" },
  ];
  return (
    <Card label={m.kpi.label} className="pipe-panel is-kpi rise">
      {items.map((k) => (
        <div key={k.n} className="pipe-kpi">
          <span className="text-sm text-text-secondary">{k.n}</span>
          <span className={`pipe-kpi-value ${k.c}`}>{k.v}</span>
          <span className="text-sm text-text-muted">{k.s}</span>
        </div>
      ))}
    </Card>
  );
}
