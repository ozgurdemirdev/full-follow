import type { CSSProperties } from "react";
import { m } from "../messages";
import type { TlWeek } from "../types";

const PERCENT = 100;
const share = (n: number, total: number) => `${total ? Math.round((n / total) * PERCENT) : 0}%`;

/** "Bu hafta kim ne yaptı": the Sen vs Claude split bar and the week counts */
export function WeekStrip({ week, className, style }: { week: TlWeek; className?: string; style?: CSSProperties }) {
  const total = week.me + week.cl;
  return (
    <section aria-label={m.week.label} className={`tlx-strip ${className ?? ""}`} style={style}>
      <div className="tlx-lead">
        <span className="tlx-label">{m.week.whoDidWhat}</span>
        <div className="tlx-bar">
          <span className="grow-x bg-text-primary" style={{ width: share(week.me, total) }} />
          <span className="grow-x bg-claude" style={{ width: share(week.cl, total) }} />
        </div>
        <div className="tlx-legend">
          <span><span className="tlx-dot bg-text-primary" />{m.actor.ozgur} {week.me}</span>
          <span className="text-claude-soft"><span className="tlx-dot bg-claude" />{m.actor.claude} {week.cl}</span>
        </div>
      </div>
      {week.tiles.map((t) => (
        <div key={t.type} className="tlx-tile" data-tlt={t.type}>
          <span className="tlx-label"><span className="tlx-dot" />{t.label}</span>
          <span className="tlx-value">{t.value}</span>
          <span className="tlx-sub">{t.sub}</span>
        </div>
      ))}
    </section>
  );
}
