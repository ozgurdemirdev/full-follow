import { Link } from "wouter";
import { useQuery } from "../../api/store";
import type { Plan, Report } from "../../api/types";
import { PATHS } from "../../app/routes";
import { lira } from "../../lib/format";
import { Meter } from "../ui";

interface Item {
  key: string;
  name: string;
  value: string;
  of: string;
  pct: number;
  href?: string;
}

const percent = (v: number, of: number) => (of > 0 ? Math.round((v / of) * 100) : 0);

function GoalMeter({ it }: { it: Item }) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-5">
        <span className="text-base-sm text-text-secondary">{it.name}</span>
        <span className="text-base-sm text-text-secondary">
          <span className="font-mono text-md text-text-primary">{it.value}</span> / {it.of}
        </span>
      </div>
      <Meter value={it.pct} size="xl" knob={`%${it.pct}`} label={it.name} />
    </>
  );
  // the daily goal is logged on the calendar page
  return it.href ? <Link href={it.href} className="dash-goal">{body}</Link> : <div className="dash-goal">{body}</div>;
}

/** Goal strip: this month's collections against the monthly floor, weekly outgoing against the weekly target, the first daily goal */
export function GoalMeters({ plan, sent, target }: { plan: Plan; sent: number; target: number }) {
  const report = useQuery<Report>("/report");
  const month = report.data?.month;
  const goal = plan.goals[0];
  const items: Item[] = [];
  if (month && month.floor > 0) {
    items.push({ key: "month", name: "Aylık ciro", value: lira(month.collected), of: lira(month.floor), pct: percent(month.collected, month.floor) });
  }
  if (target > 0) items.push({ key: "week", name: "Haftalık temas", value: String(sent), of: String(target), pct: percent(sent, target) });
  if (goal) items.push({ key: "goal", name: goal.title, value: String(goal.done), of: String(goal.target), pct: percent(goal.done, goal.target), href: PATHS.calendar });
  if (!items.length) return null;
  return (
    <section aria-label="Hedefler" className="dash-goals rise">
      {items.map((it) => <GoalMeter key={it.key} it={it} />)}
    </section>
  );
}
