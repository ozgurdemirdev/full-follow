import { run } from "@kit/api/actions";
import type { GoalDay, Plan, PlanTask, Today } from "@kit/api/types";
import { openSheet } from "@kit/app/ui";
import { CALENDAR_PATH } from "../paths";
import { fmtDay, fmtToday } from "@kit/lib/format";
import { KIND, OF_TASK_KIND } from "../calendar";
import { goalAutoNote } from "../goals";
import { BoardIcon } from "@kit/components/boardIcons";
import { toast } from "@kit/components/toast";
import { Card, Meter } from "@kit/components/ui";
import { useExpand } from "@kit/components/ExpandOverlay";
import { DashOverlay, type ExRow } from "@kit/components/dash/DashOverlay";

/** Time column of a task row without a time */
const ANYTIME = "Gün içi";

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
  toast(`${g.title} +1`, "ok", { label: "Geri al", run: () => void log(-1) });
};

function items(plan: Plan): Item[] {
  const task = (t: PlanTask): Item => ({
    key: `t${t.id}`,
    done: !!t.done_at,
    time: t.due_time ?? ANYTIME,
    title: t.title,
    kind: `${KIND[OF_TASK_KIND[t.kind]].label}${t.due_date && t.due_date < plan.date && !t.done_at ? ` · ${fmtDay(t.due_date)} tarihliydi` : ""}`,
    dot: KIND[OF_TASK_KIND[t.kind]].dot,
    toggle: () => void run("patch", `/tasks/${t.id}`, { done: !t.done_at }, { silent: true }).catch(() => {}),
  });
  const goal = (g: GoalDay): Item => ({
    key: `g${g.id}`,
    done: g.complete,
    time: `${g.done}/${g.target}`,
    title: g.title,
    kind: ["Hedef", goalAutoNote(g)].filter(Boolean).join(" · "),
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
    key: i.key, lead: i.time === ANYTIME ? "Gün" : i.time, mono: true, title: i.title, sub: i.kind, tag: i.done ? "Tamamlandı" : "Bekliyor",
    dot: i.done ? "bg-accent" : "bg-entity-later", href: CALENDAR_PATH,
  }));

  return (
    <>
      <Card title="Bugünün planı" count={`${list.length} iş`} onExpand={(r) => ex.show("plan", r)} className="dash-gap-5 rise">
        <div className="flex items-center gap-4">
          <Meter value={share} className="flex-grow" label="Bugünün planı" />
          <span className="whitespace-nowrap text-sm text-text-secondary">{done} / {list.length} tamam</span>
        </div>
        <div className="flex flex-col">
          {list.length === 0 ? <p className="m-0 border-t border-border-subtle py-5 text-base-sm text-text-muted">Bugün için iş yok.</p> : null}
          {list.map((i) => (
            <div key={i.key} className="flex items-center gap-5 border-t border-border-subtle py-3">
              <button type="button" className="dash-ck" aria-pressed={i.done} aria-label={`${i.title}${i.done ? ", tamamlandı" : ", tamamla"}`} onClick={i.toggle}>
                <BoardIcon name="check" className="size-icon-xs" stroke={2.4} />
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
          <BoardIcon name="plus" className="size-icon-chip" stroke={2} />
          Plana ekle
        </button>
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: "Bugünün planı", sub: `${fmtToday(plan.date)} · ${list.length} iş, ${done} tamamlandı`, page: "Takvim", href: CALENDAR_PATH, foot: `${list.length - done} iş açık`, rows }} />
    </>
  );
}
