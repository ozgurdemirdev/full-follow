import { Link } from "wouter";
import { useQuery } from "@kit/api/store";
import type { Plan, Report, Today } from "@kit/api/types";
import { m as kit } from "@kit/messages";
import { m } from "../messages";
import { CALENDAR_PATH } from "../paths";
import { lira } from "@kit/lib/format";
import { Meter } from "@kit/components/ui";

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
    items.push({ key: "month", name: m.monthlyRevenue, value: lira(month.collected), of: lira(month.floor), pct: percent(month.collected, month.floor) });
  }
  if (target > 0) items.push({ key: "week", name: m.weeklyTouch, value: String(sent), of: String(target), pct: percent(sent, target) });
  if (goal) items.push({ key: "goal", name: goal.title, value: String(goal.done), of: String(goal.target), pct: percent(goal.done, goal.target), href: CALENDAR_PATH });
  if (!items.length) return null;
  return (
    <section aria-label={kit.nouns.goals} className="dash-goals rise">
      {items.map((it) => <GoalMeter key={it.key} it={it} />)}
    </section>
  );
}

/** The dashboard's goal strip (slot "dashboard.strip"): drawn when the Today payload carries the plan, the week and the network settings */
export function GoalStrip({ today }: { today: Today }) {
  const { plan, week, network } = today;
  if (!plan || !week || !network) return null;
  return <GoalMeters plan={plan} sent={week.sent} target={network.settings.weekly_target} />;
}
