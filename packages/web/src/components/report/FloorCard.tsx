import { lira } from "../../lib/format";
import { COST_FIELDS, stackOf, TAX_MAX_PERCENT, type CostKey, type Costs } from "../../lib/report";
import { NumberField } from "../NumberField";
import { Card, order } from "../ui";

/** The floor and its parts: the five inputs are edited in place (saved after a pause), the stacked bar and the floor follow at once */
export function FloorCard({ costs, floor, hint, onChange }: { costs: Costs; floor: number; hint: string | null; onChange: (key: CostKey, value: number | null) => void }) {
  return (
    <Card title="Taban nasıl hesaplanıyor" className="rep-card rise" style={order(3)} actions={<span className="rep-aside">değiştir, hemen hesaplansın</span>}>
      {COST_FIELDS.map((f) => (
        <label key={f.key} className="rep-cost">
          <span className={`rep-dot ${f.dot}`} />
          <span className="rep-cost-name">{f.label}</span>
          <span className="rep-pill">
            <span>{f.prefix}</span>
            <NumberField className="" value={costs[f.key]} min={0} max={f.key === "tax_rate_percent" ? TAX_MAX_PERCENT : undefined} ariaLabel={f.label} onChange={(v) => onChange(f.key, v)} />
          </span>
        </label>
      ))}
      <div className="rep-stack">
        {stackOf(costs).map((p) => <span key={p.key} className={`grow-x ${p.dot}`} title={p.label} style={{ width: `${p.width}%` }} />)}
      </div>
      <div className="rep-floor-total">
        <span>Aylık taban (vergi dahil)</span>
        <span>{lira(floor)}</span>
      </div>
      {hint ? <span className="rep-hint">{hint}</span> : null}
    </Card>
  );
}
