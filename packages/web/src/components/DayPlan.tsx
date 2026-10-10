import { useState } from "react";
import { remove, run } from "../api/actions";
import type { GoalDay, Plan } from "../api/types";
import { openSheet } from "../app/ui";
import { fmtDay, pct, todayIso } from "../lib/format";
import { CHANNEL } from "../lib/labels";
import { EditDelete } from "./contact";
import { Icon } from "./icons";
import { CardHead, order } from "./ui";

/** Quick add steps shown next to each goal */
const STEPS = [1, 5];

function GoalRow({ g, date }: { g: GoalDay; date: string }) {
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState(g.note ?? "");
  const share = Math.min(100, (g.done / g.target) * 100);
  const log = (body: Record<string, unknown>, ok?: string) => run("post", `/goals/${g.id}/log`, { date, ...body }, { silent: !ok, ok }).catch(() => {});

  return (
    <div className="row flex flex-col gap-3 rounded-xl border-0 px-5 py-4">
      <div className="flex items-center gap-5">
        <span className="flex min-w-0 flex-grow flex-col">
          <span className="truncate text-base font-medium">{g.title}</span>
          <span className="truncate text-sm text-text-secondary">
            {g.channel ? `${CHANNEL[g.channel]}: giden mesajlar otomatik sayılır${g.auto ? ` (${g.auto})` : ""}` : "Elle girilir"}
            {g.goal_note ? ` · ${g.goal_note}` : ""}
          </span>
        </span>
        <span className={`font-mono text-base ${g.complete ? "text-status-text-success" : "text-text-secondary"}`}>{g.done} / {g.target}</span>
        {STEPS.map((n) => (
          <button key={n} type="button" className="btn btn-sec btn-sm" aria-label={`${g.title} +${n}`} onClick={() => void log({ add: n })}>+{n}</button>
        ))}
      </div>
      <div className="track">
        <i className={`grow-x ${g.complete ? "bg-status-text-success" : "bg-accent-payment"}`} style={{ width: `${share}%` }} />
      </div>
      <div className="flex items-center gap-3">
        {noting ? (
          <input
            className="inp"
            autoFocus
            value={note}
            placeholder="Bugüne not (örn. fuar vardı, eksik kaldı)"
            aria-label={`${g.title} günün notu`}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              setNoting(false);
              if (note.trim() !== (g.note ?? "")) void log({ note: note.trim() });
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNoting(true)}>{g.note ? `Not: ${g.note}` : "Not ekle"}</button>
        )}
        <span className="flex-grow" />
        <EditDelete label="Hedef" onEdit={() => openSheet("goal", { edit: g.id })} onDelete={() => void remove(`/goals/${g.id}`, "Hedef").catch(() => {})} />
      </div>
    </div>
  );
}

/** The day's plan: goals with progress bars, then the day's tasks. Used on the dashboard and in the calendar. */
export function DayPlan({ plan, title = "Günün planı", rank = 0 }: { plan: Plan; title?: string; rank?: number }) {
  const toggle = (id: number, done: boolean) => void run("patch", `/tasks/${id}`, { done }, { silent: true }).catch(() => {});
  const doneTasks = plan.tasks.filter((t) => t.done_at).length;
  const isToday = plan.date === todayIso();

  return (
    <section className="card rise overflow-hidden" style={order(rank)} aria-label={title}>
      <CardHead title={title}>
        <span className="flex items-center gap-4 text-sm text-text-secondary">
          {isToday && plan.streak ? <span>{plan.streak} gün seri</span> : null}
          {isToday && plan.week_ratio !== null ? <span>Hafta {pct(plan.week_ratio)}</span> : null}
          <button type="button" className="btn btn-sec btn-sm" onClick={() => openSheet("goal")}>
            <Icon name="plus" className="size-icon-sm" /> Hedef
          </button>
        </span>
      </CardHead>
      <div className="px-3 py-2">
        {plan.goals.length === 0 ? <p className="empty">Bu gün için hedef yok.</p> : plan.goals.map((g) => <GoalRow key={`${g.id}-${plan.date}`} g={g} date={plan.date} />)}
      </div>
      {plan.tasks.length ? (
        <div className="border-t border-border-subtle px-3 py-2">
          <div className="flex justify-between px-5 py-2 text-sm text-text-secondary">
            <span>Görevler</span>
            <span>{doneTasks} / {plan.tasks.length}</span>
          </div>
          {plan.tasks.map((t) => {
            const late = t.due_date && t.due_date < plan.date;
            return (
              <div key={t.id} className="row flex items-center gap-5 rounded-xl border-0 px-5 py-4">
                <button type="button" role="checkbox" aria-checked={!!t.done_at} aria-label="Tamamlandı olarak işaretle" className="chk" onClick={() => toggle(t.id, !t.done_at)}>
                  <Icon name="check" className="size-icon-sm" stroke={3} />
                </button>
                <span className="flex min-w-0 flex-grow flex-col">
                  <span className={`text-base transition-colors dur-fade ${t.done_at ? "text-text-disabled line-through" : ""}`}>{t.title}</span>
                  {late && !t.done_at ? <span className="text-sm text-status-text-attention">{fmtDay(t.due_date)} tarihliydi</span> : null}
                </span>
                <EditDelete label="Görev" onEdit={() => openSheet("task", { edit: t.id })} onDelete={() => void remove(`/tasks/${t.id}`, "Görev").catch(() => {})} />
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
