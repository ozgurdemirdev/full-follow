import { Link } from "wouter";
import type { Plan } from "../api/types";
import { PATHS } from "../app/routes";
import { pct } from "../lib/format";
import { goalAutoNote } from "../lib/goals";

/** Dashboard summary of today's goals: one thin bar per goal and a count of today's tasks. The full plan lives on the calendar page. */
export function GoalStrip({ plan }: { plan: Plan }) {
  const open = plan.tasks.filter((t) => !t.done_at).length;
  return (
    <Link href={PATHS.calendar} className="flex flex-col gap-4 rounded-xl border border-border-subtle px-9 py-6 text-text-primary hover:border-border-strong hover:text-text-primary" aria-label="Günün planı, takvim sayfasına git">
      <span className="flex items-center gap-4 text-sm text-text-secondary">
        <span className="flex-grow">Günlük hedefler</span>
        {plan.streak ? <span>{plan.streak} gün seri</span> : null}
        {plan.week_ratio !== null ? <span>Hafta {pct(plan.week_ratio)}</span> : null}
        <span>{open ? `${open} görev bekliyor` : "görev yok"}</span>
      </span>
      {plan.goals.length === 0 ? (
        <span className="text-base text-text-muted">Henüz günlük hedef yok. Takvim sayfasından ekle.</span>
      ) : (
        <span className="grid grid-cols-1 gap-x-9 gap-y-4 desk:grid-cols-2">
          {plan.goals.map((g) => (
            <span key={g.id} className="flex flex-col gap-2">
              <span className="flex items-baseline justify-between gap-4 text-base">
                <span className="truncate">{g.title}</span>
                <span className={`font-mono text-sm ${g.complete ? "text-status-text-success" : "text-text-secondary"}`}>{g.done} / {g.target}</span>
              </span>
              <span className="track">
                <i className={`grow-x ${g.complete ? "bg-status-text-success" : "bg-accent-payment"}`} style={{ width: `${Math.min(100, (g.done / g.target) * 100)}%` }} />
              </span>
              {g.metric ? <span className="text-xs text-text-muted">{goalAutoNote(g)}</span> : null}
            </span>
          ))}
        </span>
      )}
    </Link>
  );
}
