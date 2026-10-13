import { useState } from "react";
import { remove, run } from "../api/actions";
import type { GoalDay, Plan, PlanTask } from "../api/types";
import { openSheet } from "../app/ui";
import { fmtDay, pct, todayIso } from "../lib/format";
import { goalAutoNote } from "../lib/goals";
import { EditDelete } from "./contact";
import { Icon } from "./icons";
import { toast } from "./toast";

/** Quick add steps shown next to each goal */
const STEPS = [1, 5];

/** Small "more" toggle that reveals a row's secondary actions */
function More({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open} aria-label={`${label}: diğer işlemler`} onClick={onToggle}>
      ⋯
    </button>
  );
}

function GoalRow({ g, date }: { g: GoalDay; date: string }) {
  const [more, setMore] = useState(false);
  const [note, setNote] = useState(g.note ?? "");
  const share = Math.min(100, (g.done / g.target) * 100);
  const log = (body: Record<string, unknown>) => run("post", `/goals/${g.id}/log`, { date, ...body }, { silent: true }).catch(() => {});
  /** A step on the count; the toast offers to take it back (the count never goes below 0) */
  const step = async (n: number) => {
    await log({ add: n });
    toast(`${g.title} ${n > 0 ? "+" : ""}${n}`, "ok", { label: "Geri al", run: () => void log({ add: -n }) });
  };
  const sub = [goalAutoNote(g), g.goal_note ?? "", g.note ?? ""].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-2 py-4">
      {/* phone: title and count on the first row, the buttons on their own row below */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-medium">{g.title}</span>
          {sub ? <span className="truncate text-sm text-text-muted">{sub}</span> : null}
        </span>
        <span className={`font-mono text-base ${g.complete ? "text-status-text-success" : "text-text-secondary"}`}>{g.done} / {g.target}</span>
        <span className="flex basis-full items-center justify-end gap-3 desk:basis-auto">
          <button type="button" className="btn btn-sec btn-sm" aria-label={`${g.title} -1`} disabled={g.manual < 1} onClick={() => void step(-1)}>−1</button>
          {STEPS.map((n) => (
            <button key={n} type="button" className="btn btn-pri btn-sm" aria-label={`${g.title} +${n}`} onClick={() => void step(n)}>+{n}</button>
          ))}
          <More open={more} onToggle={() => setMore(!more)} label={g.title} />
        </span>
      </div>
      <div className="track">
        <i className={`grow-x ${g.complete ? "bg-status-text-success" : "bg-accent-payment"}`} style={{ width: `${share}%` }} />
      </div>
      {more ? (
        <div className="flex items-center gap-3">
          <input
            className="inp"
            value={note}
            placeholder="Bugüne not (örn. fuar vardı, eksik kaldı)"
            aria-label={`${g.title} günün notu`}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note.trim() !== (g.note ?? "") && void log({ note: note.trim() })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <EditDelete label="Hedef" onEdit={() => openSheet("goal", { edit: g.id })} onDelete={() => void remove(`/goals/${g.id}`, "Hedef").catch(() => {})} />
        </div>
      ) : null}
    </div>
  );
}

function TaskRow({ t, date }: { t: PlanTask; date: string }) {
  const [more, setMore] = useState(false);
  const late = t.due_date && t.due_date < date;
  return (
    <div className="flex items-center gap-4 py-3">
      <button type="button" role="checkbox" aria-checked={!!t.done_at} aria-label="Tamamlandı olarak işaretle" className="chk" onClick={() => void run("patch", `/tasks/${t.id}`, { done: !t.done_at }, { silent: true }).catch(() => {})}>
        <Icon name="check" className="size-icon-sm" stroke={3} />
      </button>
      <span className="flex min-w-0 flex-grow flex-col">
        <span className={`text-base transition-colors dur-fade ${t.done_at ? "text-text-disabled line-through" : ""}`}>{t.title}</span>
        {late && !t.done_at ? <span className="text-sm text-status-text-attention">{fmtDay(t.due_date)} tarihliydi</span> : null}
      </span>
      {more ? <EditDelete label="Görev" onEdit={() => openSheet("task", { edit: t.id })} onDelete={() => void remove(`/tasks/${t.id}`, "Görev").catch(() => {})} /> : null}
      <More open={more} onToggle={() => setMore(!more)} label={t.title} />
    </div>
  );
}

/** One day's plan on its own page: goals with thin progress bars, then the day's tasks. Plain list, no card. */
export function DayPlan({ plan, title }: { plan: Plan; title: string }) {
  const doneTasks = plan.tasks.filter((t) => t.done_at).length;
  const isToday = plan.date === todayIso();

  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex items-center gap-4">
        <h2 className="card-title flex-grow">{title}</h2>
        {isToday && plan.streak ? <span className="text-sm text-text-muted">{plan.streak} gün seri</span> : null}
        {isToday && plan.week_ratio !== null ? <span className="text-sm text-text-muted">Hafta {pct(plan.week_ratio)}</span> : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("task", { date: plan.date })}>
          <Icon name="plus" className="size-icon-sm" /> Görev
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("goal")}>
          <Icon name="plus" className="size-icon-sm" /> Hedef
        </button>
      </div>
      <div className="flex flex-col divide-y divide-border-subtle">
        {plan.goals.length === 0 && plan.tasks.length === 0 ? <p className="empty">Bu gün için hedef ya da görev yok.</p> : null}
        {plan.goals.map((g) => <GoalRow key={`${g.id}-${plan.date}`} g={g} date={plan.date} />)}
      </div>
      {plan.tasks.length ? (
        <div className="flex flex-col pt-4">
          <span className="pb-1 text-sm text-text-muted">Görevler · {doneTasks} / {plan.tasks.length}</span>
          {plan.tasks.map((t) => <TaskRow key={t.id} t={t} date={plan.date} />)}
        </div>
      ) : null}
    </section>
  );
}
