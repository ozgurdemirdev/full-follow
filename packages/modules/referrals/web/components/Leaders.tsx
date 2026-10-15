import type { ReferralValue } from "@kit/api/types";
import { lira } from "@kit/lib/format";
import { Avatar } from "@kit/components/ui";

const share = (v: number, max: number) => `${max ? ((v / max) * 100).toFixed(1) : 0}%`;

const subText = (r: ReferralValue) =>
  [`${r.direct} kişi tanıttı`, r.network > r.direct ? `ağıyla ${r.network}` : "", r.won ? `${r.won} kazanıldı` : ""].filter(Boolean).join(" · ");
/** Opportunity and project counts of the network, as the tooltip of the row */
const detailText = (r: ReferralValue) => [r.opps ? `${r.opps} fırsat` : "", r.projects ? `${r.projects} proje` : ""].filter(Boolean).join(" · ");
const openText = (r: ReferralValue) => (r.open_value ? `açıkta ${lira(r.open_value)}` : r.collected ? `tahsil ${lira(r.collected)}` : "açık iş yok");

/** "Tanıtanlar": who introduced whom, with the won and open value of the whole network as bars; one is selected for the tree */
export function Leaders({ rows, selected, onPick }: { rows: ReferralValue[]; selected: number | null; onPick: (id: number) => void }) {
  const max = rows.reduce((m, r) => Math.max(m, r.won_value + r.open_value), 0);
  return (
    <section className="ref-leaders" aria-label="Tanıtanlar">
      <div className="ref-leaders-head">
        <h2>Tanıtanlar</h2>
        <span>ağıyla birlikte değer</span>
      </div>
      {rows.map((r, i) => (
        <button key={r.person_id} type="button" className="ref-lead" title={detailText(r) || undefined} aria-pressed={r.person_id === selected} onClick={() => onPick(r.person_id)}>
          <span className="ref-lead-top">
            <span className="ref-rank">{i + 1}</span>
            <Avatar name={r.name} id={r.person_id} size="list" />
            <span className="ref-lead-name">
              <b>{r.name}{r.company_name ? <i> · {r.company_name}</i> : null}</b>
              <span>{subText(r)}</span>
            </span>
            <span className="ref-lead-value">
              <b>{lira(r.won_value)}</b>
              <span>{openText(r)}</span>
            </span>
          </span>
          <span className="ff-meter ref-bar" data-size="sm">
            <i className="grow-x bg-accent" style={{ width: share(r.won_value, max) }} />
            <i className="grow-x bg-entity-later" style={{ width: share(r.open_value, max) }} />
          </span>
        </button>
      ))}
    </section>
  );
}
