import type { RefKpi } from "../types";
import { order } from "@kit/components/ui";

/** Four numbers on top: won from referrals, still open, close rate against the other sources, people introduced */
export function Kpis({ items }: { items: RefKpi[] }) {
  return (
    <section className="ref-kpi rise" style={order(1)} aria-label="Özet">
      {items.map((k) => (
        <div key={k.label} className="ref-kpi-item">
          <span className="ref-kpi-label">{k.label}</span>
          <span className="ref-kpi-value" data-accent={k.accent ? "" : undefined}>{k.value}</span>
          <span className="ref-kpi-sub">{k.sub}</span>
        </div>
      ))}
    </section>
  );
}
