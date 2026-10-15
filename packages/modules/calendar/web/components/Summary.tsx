import { pct } from "@kit/lib/format";
import { KINDS, type Kind } from "../calendar";
import { Meter } from "@kit/components/ui";
import { m } from "../messages";

const PERCENT = 100;

export interface WeekStats {
  done: number;
  total: number;
  /** open items of today, they move to tomorrow */
  left: number;
  /** share of the week's goal targets that is filled, null without goals */
  goalFill: number | null;
  /** the goal furthest behind, when one is below the threshold */
  behind: { title: string; done: number; target: number } | null;
}

/** "Hafta özeti": done this week, left for tomorrow, goal fill */
export function WeekSummary({ s }: { s: WeekStats }) {
  return (
    <section aria-label={m.summary.title} className="cal-sum rise">
      <div className="flex min-w-0 flex-col gap-3">
        <span className="text-sm text-text-secondary">{m.summary.doneThisWeek}</span>
        <span className="text-cal-num leading-none tracking-kpi">{s.done}<span className="text-md text-text-muted"> / {s.total}</span></span>
        <Meter value={s.total ? (s.done / s.total) * PERCENT : 0} label={m.summary.doneThisWeek} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-text-secondary">{m.summary.leftForTomorrow}</span>
        <span className="text-cal-num leading-none tracking-kpi">{s.left}</span>
        <span className="text-sm text-text-secondary">{m.summary.carriedFromToday}</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-text-secondary">{m.summary.goalFill}</span>
        <span className="text-cal-num leading-none tracking-kpi">{pct(s.goalFill)}</span>
        {s.behind ? (
          <span className="text-sm text-warning">{m.summary.behind(s.behind.title, s.behind.done, s.behind.target)}</span>
        ) : (
          <span className="text-sm text-text-secondary">{s.goalFill === null ? m.summary.noGoalsThisWeek : m.summary.goalsOnTrack}</span>
        )}
      </div>
    </section>
  );
}

/** Kind pills: each toggles the visibility of its items, the mono number is the count of the week */
export function KindPills({ counts, hidden, onToggle }: { counts: Record<Kind, number>; hidden: ReadonlySet<Kind>; onToggle: (k: Kind) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rise" role="group" aria-label={m.summary.show}>
      {KINDS.map((k) => (
        <button key={k.key} type="button" className="cal-kind" aria-pressed={!hidden.has(k.key)} onClick={() => onToggle(k.key)}>
          <span className={`cal-kind-dot ${k.dot}`} />
          {k.label}
          <span className="font-mono text-xs text-text-muted">{counts[k.key]}</span>
        </button>
      ))}
    </div>
  );
}
