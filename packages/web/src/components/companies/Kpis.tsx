import { UNREACHED_NAMED, type Totals } from "../../lib/companies";
import { lira } from "../../lib/format";

interface Kpi {
  label: string;
  value: string;
  sub: string;
  tone: string;
}

/** Sub line of the decision maker card: who is not reached, or what to do while nobody is marked */
function unreachedSub(t: Totals): string {
  if (!t.deciders) return "Kişilere karar rolü ver";
  if (!t.unreached.length) return "Hepsine ulaşıldı";
  const extra = t.unreached.length - UNREACHED_NAMED;
  const named = t.unreached.slice(0, UNREACHED_NAMED).join(", ");
  return extra > 0 ? `${named} ve ${extra} firma` : named;
}

/** The numbers on top */
export function Kpis({ t }: { t: Totals }) {
  const items: Kpi[] = [
    { label: "Kazanılan", value: lira(t.won), sub: "tüm firmalardan", tone: "var(--color-accent)" },
    { label: "Bekleyen tahsilat", value: lira(t.due), sub: `${t.dueCompanies} firmada`, tone: "var(--color-warning)" },
    { label: "Açık fırsat", value: lira(t.open), sub: `${t.openCompanies} firmada`, tone: "var(--color-text-primary)" },
    { label: "Karar vericiye ulaşılmamış", value: String(t.unreached.length), sub: unreachedSub(t), tone: "var(--color-claude-soft)" },
  ];
  return (
    <section aria-label="Özet" className="co-kpi" style={{ ["--kpis" as string]: items.length }}>
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
