import { lira } from "@kit/lib/format";
import { m } from "../messages";
import type { Hero as HeroData } from "../report";
import { order } from "@kit/components/ui";

/** This month's (or the picked month's) collections against the floor: gap or surplus, hatched meter with the expected rest and the floor marker, insight sentence */
export function Hero({ hero: h, insight }: { hero: HeroData; insight: string | null }) {
  const over = h.gap <= 0;
  return (
    <section aria-label={m.hero.thisMonth} className="rep-hero rise" style={order(1)}>
      <div className="rep-hero-top">
        <div className="rep-hero-got">
          <span className="rep-hero-label">{m.hero.collection(h.label)}</span>
          <span className="rep-hero-num">{lira(h.collected)}</span>
        </div>
        <div className="rep-hero-gap">
          <span className={over ? "text-accent" : "text-warning"}>{over ? m.hero.above(lira(-h.gap)) : m.hero.short(lira(h.gap))}</span>
          <span>{m.hero.floor(lira(h.floor))}</span>
        </div>
      </div>
      <div className="ff-meter rep-meter" role="meter" aria-label={m.hero.meter} aria-valuemin={0} aria-valuemax={h.floor} aria-valuenow={h.collected}>
        <span className={`ff-meter-fill grow-x ${over ? "bg-accent" : "bg-report-under"}`} style={{ width: `${h.fill}%` }} />
        {h.pendingAmount > 0 ? <span className="rep-pending" style={{ left: `${h.fill}%`, width: `${h.pending}%` }} /> : null}
        <span className="ff-meter-marker" style={{ left: `${h.floorX}%` }} />
      </div>
      <div className="rep-legend">
        <span><span className="rep-dot bg-accent" />{m.hero.came}</span>
        {h.pendingAmount > 0 ? <span><span className="rep-dot bg-warning" />{m.hero.expected(lira(h.pendingAmount))}</span> : null}
        <span><span className="rep-tick" />{m.hero.floorTick}</span>
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
