import { run } from "@kit/api/actions";
import type { GoalDay, Plan, PlanTask, Today } from "@kit/api/types";
import { openSheet } from "@kit/app/ui";
import { m as kit } from "@kit/messages";

import { m } from "../messages";
import { CALENDAR_PATH } from "../paths";
import { fmtDay, fmtToday } from "@kit/lib/format";
import { ANYTIME, KIND, OF_TASK_KIND } from "../calendar";
import { goalAutoNote } from "../goals";
import { BoardIcon } from "@kit/components/boardIcons";
import { toast } from "@kit/components/toast";
import { Card, Meter } from "@kit/components/ui";
import { useExpand } from "@kit/components/ExpandOverlay";
import { DashOverlay, type ExRow } from "@kit/components/dash/DashOverlay";
import { stroke as STROKE } from "@kit/styles/tokens.json";

interface Item {
  key: string;
  done: boolean;
  time: string;
  title: string;
  kind: string;
  dot: string;
  toggle: () => void;
}

/** A goal row logs one more when ticked; the toast takes it back */
const logGoal = async (g: GoalDay, date: string) => {
  const log = (add: number) => run("post", `/goals/${g.id}/log`, { date, add }, { silent: true }).catch(() => {});
  await log(1);
  toast(m.delta(g.title, 1), "ok", { label: kit.undo, run: () => void log(-1) });
};

function items(plan: Plan): Item[] {
  const task = (t: PlanTask): Item => ({
    key: `t${t.id}`,
    done: !!t.done_at,
    time: t.due_time ?? ANYTIME,
    title: t.title,
    kind: `${KIND[OF_TASK_KIND[t.kind]].label}${t.due_date && t.due_date < plan.date && !t.done_at ? m.wasDue(fmtDay(t.due_date)) : ""}`,
    dot: KIND[OF_TASK_KIND[t.kind]].dot,
    toggle: () => void run("patch", `/tasks/${t.id}`, { done: !t.done_at }, { silent: true }).catch(() => {}),
  });
  const goal = (g: GoalDay): Item => ({
    key: `g${g.id}`,
    done: g.complete,
    time: `${g.done}/${g.target}`,
    title: g.title,
    kind: [kit.nouns.goal, goalAutoNote(g)].filter(Boolean).join(" · "),
    dot: "bg-accent",
    toggle: () => void (g.complete ? Promise.resolve() : logGoal(g, plan.date)),
  });
  return [...plan.tasks.map(task), ...plan.goals.map(goal)];
}

/** "Bugünün planı": the day's tasks and goals with check off, and the way to add a task */
export function PlanCard({ today }: { today: Today }) {
  const plan = today.plan!; // the manifest shows the card only when the plan is there
  const ex = useExpand();
  const list = items(plan);
  const done = list.filter((i) => i.done).length;
  const share = list.length ? (done / list.length) * 100 : 0;
  const rows: ExRow[] = list.map((i) => ({
    key: i.key, lead: i.time === ANYTIME ? m.dayShort : i.time, mono: true, title: i.title, sub: i.kind, tag: i.done ? m.statusDone : m.statusPending,
    dot: i.done ? "bg-accent" : "bg-entity-later", href: CALENDAR_PATH,
  }));

  return (
    <>
      <Card title={m.todayPlan} count={m.items(list.length)} onExpand={(r) => ex.show("plan", r)} className="dash-gap-5 rise">
        <div className="flex items-center gap-4">
          <Meter value={share} className="flex-grow" label={m.todayPlan} />
          <span className="whitespace-nowrap text-sm text-text-secondary">{m.progress(done, list.length)}</span>
        </div>
        <div className="flex flex-col">
          {list.length === 0 ? <p className="m-0 border-t border-border-subtle py-5 text-base-sm text-text-muted">{m.noWorkToday}</p> : null}
          {list.map((i) => (
            <div key={i.key} className="flex items-center gap-5 border-t border-border-subtle py-3">
              <button type="button" className="dash-ck" aria-pressed={i.done} aria-label={m.tickLabel(i.title, i.done)} onClick={i.toggle}>
                <BoardIcon name="check" className="size-icon-xs" stroke={STROKE.bold} />
              </button>
              <span className={`w-dash-time-col flex-none whitespace-nowrap font-mono text-sm ${i.done ? "text-entity-later" : "text-text-secondary"}`}>{i.time}</span>
              <div className={`flex min-w-0 flex-grow flex-col ${i.done ? "opacity-muted" : ""}`}>
                <span className={`truncate text-base ${i.done ? "line-through" : ""}`}>{i.title}</span>
                <span className="flex items-center gap-2 text-sm text-text-secondary"><span className={`dash-dot ${i.dot}`} />{i.kind}</span>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="dash-btn is-dashed mt-auto" onClick={() => openSheet("task", { date: plan.date })}>
          <BoardIcon name="plus" className="size-icon-chip" stroke={STROKE.regular} />
          {m.addToPlan}
        </button>
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: m.todayPlan, sub: m.planSub(fmtToday(plan.date), list.length, done), page: m.label, href: CALENDAR_PATH, foot: m.planFoot(list.length - done), rows }} />
    </>
  );
}
