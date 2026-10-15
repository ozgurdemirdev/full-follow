import { UNREACHED_NAMED, type Totals } from "../companies";
import { lira } from "@kit/lib/format";
import { m } from "../messages";

interface Kpi {
  label: string;
  value: string;
  sub: string;
  tone: string;
}

/** Sub line of the decision maker card: who is not reached, or what to do while nobody is marked */
function unreachedSub(t: Totals): string {
  if (!t.deciders) return m.kpis.giveRoles;
  if (!t.unreached.length) return m.kpis.allReached;
  const extra = t.unreached.length - UNREACHED_NAMED;
  const named = t.unreached.slice(0, UNREACHED_NAMED).join(", ");
  return extra > 0 ? m.kpis.namedAndMore(named, extra) : named;
}

/** The numbers on top */
export function Kpis({ t }: { t: Totals }) {
  const items: Kpi[] = [
    { label: m.money.won, value: lira(t.won), sub: m.kpis.allCompanies, tone: "var(--color-accent)" },
    { label: m.kpis.dueTitle, value: lira(t.due), sub: m.kpis.inCompanies(t.dueCompanies), tone: "var(--color-warning)" },
    { label: m.money.open, value: lira(t.open), sub: m.kpis.inCompanies(t.openCompanies), tone: "var(--color-text-primary)" },
    { label: m.kpis.unreachedTitle, value: String(t.unreached.length), sub: unreachedSub(t), tone: "var(--color-claude-soft)" },
  ];
  return (
    <section aria-label={m.kpis.summary} className="co-kpi" style={{ ["--kpis" as string]: items.length }}>
      {items.map((k) => (
        <div key={k.label}>
          <span className="co-kpi-label">{k.label}</span>
          <span className="co-kpi-value" style={{ ["--tone" as string]: k.tone }}>{k.value}</span>
          <span className="co-kpi-sub">{k.sub}</span>
        </div>
      ))}
    </section>
  );
}
