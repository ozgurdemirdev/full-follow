import type { Money } from "../../lib/companies";

const PARTS = ["won", "due", "open"] as const;

/** Won, due and open money as three segments on the hatched track; widths are relative to the biggest company (`max`) */
export function MoneyBar({ money, max, large = false }: { money: Money; max: number; large?: boolean }) {
  return (
    <div className={`co-money ${large ? "is-lg" : ""}`} aria-hidden="true">
      {PARTS.map((k) => <span key={k} data-k={k} className="grow-x" style={{ width: `${(money[k] / max) * 100}%` }} />)}
    </div>
  );
}
