import { lira } from "../../lib/format";
import type { Hero as HeroData } from "../../lib/report";
import { order } from "../ui";

/** This month's (or the picked month's) collections against the floor: gap or surplus, hatched meter with the expected rest and the floor marker, insight sentence */
export function Hero({ hero: h, insight }: { hero: HeroData; insight: string }) {
  const over = h.gap <= 0;
  return (
    <section aria-label="Bu ay" className="rep-hero rise" style={order(1)}>
      <div className="rep-hero-top">
        <div className="rep-hero-got">
          <span className="rep-hero-label">{h.label} tahsilat</span>
          <span className="rep-hero-num">{lira(h.collected)}</span>
        </div>
        <div className="rep-hero-gap">
          <span className={over ? "text-accent" : "text-warning"}>{over ? `Tabanın ${lira(-h.gap)} üstünde` : `Tabana ${lira(h.gap)} kaldı`}</span>
          <span>aylık taban {lira(h.floor)}</span>
        </div>
      </div>
      <div className="ff-meter rep-meter" role="meter" aria-label="Tahsilat ve taban" aria-valuemin={0} aria-valuemax={h.floor} aria-valuenow={h.collected}>
        <span className={`ff-meter-fill grow-x ${over ? "bg-accent" : "bg-report-under"}`} style={{ width: `${h.fill}%` }} />
        {h.pendingAmount > 0 ? <span className="rep-pending" style={{ left: `${h.fill}%`, width: `${h.pending}%` }} /> : null}
        <span className="ff-meter-marker" style={{ left: `${h.floorX}%` }} />
      </div>
      <div className="rep-legend">
        <span><span className="rep-dot bg-accent" />gelen</span>
        {h.pendingAmount > 0 ? <span><span className="rep-dot bg-warning" />bu ay gelmesi beklenen {lira(h.pendingAmount)}</span> : null}
        <span><span className="rep-tick" />taban</span>
      </div>
      {insight ? (
        <p className="rep-insight">
          <span className="rep-dot" />
          <span>{insight}</span>
        </p>
      ) : null}
    </section>
  );
}
