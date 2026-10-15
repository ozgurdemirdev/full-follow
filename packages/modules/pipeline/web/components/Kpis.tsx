import { lira } from "@kit/lib/format";
import type { PipelineStats } from "../pipeline";
import { Card } from "@kit/components/ui";

/** The four numbers on top: open value, weighted forecast, won this month against the monthly floor, stale count */
export function Kpis({ stats, floor }: { stats: PipelineStats; floor: number }) {
  const items = [
    { n: "Açık fırsat", v: lira(stats.openValue), s: `${stats.open} fırsat`, c: "text-text-primary" },
    { n: "Ağırlıklı tahmin", v: lira(stats.weighted), s: "aşama ihtimaliyle çarpılmış", c: "text-accent" },
    { n: "Bu ay kazanılan", v: lira(stats.wonValue), s: floor ? `taban ${lira(floor)}` : "bu ay kapanan", c: "text-text-primary" },
    { n: "Bekleyip bayatlayan", v: String(stats.stale), s: "aşama süresini aştı", c: stats.stale ? "text-warning" : "text-success" },
  ];
  return (
    <Card label="Tahmin" className="pipe-panel is-kpi rise">
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
