import type { MonthReport } from "@kit/api/types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { fmtMonth, fmtMonthShort, lira } from "@kit/lib/format";
import { INCOMING_COLOR, possessive, shortLira, type Incoming } from "../report";
import { Card, order } from "@kit/components/ui";

/** Last months as bars against the floor line (clicking one switches the hero), then the payments expected this month */
export function MonthsCard({ months, floor, top, now, picked, onPick, above, incoming }: {
  months: MonthReport[];
  floor: number;
  /** value at the top of the bar scale, shared with the hero meter */
  top: number;
  /** current month (YYYY-MM) */
  now: string;
  picked: number;
  onPick: (i: number) => void;
  /** how many of the earlier months reached the floor */
  above: number;
  incoming: Incoming[];
}) {
  const earlier = months.filter((m) => m.month !== now).length;
  const floorRatio = { ["--r" as string]: floor / top };
  return (
    <Card title={`Son ${months.length} ay`} className="rep-card rep-gap-lg rise" style={order(2)} actions={<span className="rep-aside">Son {earlier} ayın {possessive(above)} tabanın üstünde</span>}>
      <div className="rep-chart">
        <span className="rep-floor" style={floorRatio} />
        <span className="rep-floor-tag" style={floorRatio}>taban</span>
        {months.map((m, i) => (
          <button key={m.month} type="button" className="rep-month" aria-pressed={i === picked} aria-label={`${fmtMonth(m.month)} ${lira(m.collected)}`}
            data-ok={m.collected >= floor} data-now={m.month === now} onClick={() => onPick(i)}>
            <span className="rep-month-value">{shortLira(m.collected)}</span>
            <span className="rep-bar" style={{ ["--r" as string]: m.collected / top }} />
            <span className="rep-month-name">{fmtMonthShort(m.month)}</span>
          </button>
        ))}
      </div>
      <div className="rep-incoming">
        <span className="rep-incoming-title">Bu ay gelmesi beklenenler</span>
        {incoming.length ? incoming.map((p) => (
          <RecordLink key={p.id} type="project" id={p.projectId} className="rep-row">
            <span className={`rep-dot ${INCOMING_COLOR[p.group].dot}`} />
            <span className="rep-row-name">{p.name}</span>
            <span className={`rep-row-when ${INCOMING_COLOR[p.group].text}`}>{p.when}</span>
            <span className="rep-row-amount">{lira(p.amount)}</span>
          </RecordLink>
        )) : <p className="rep-incoming-empty">Bu ay beklenen ödeme yok.</p>}
      </div>
    </Card>
  );
}
