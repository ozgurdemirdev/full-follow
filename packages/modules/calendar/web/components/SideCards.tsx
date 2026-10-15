import { useState } from "react";
import { remove, run } from "@kit/api/actions";
import type { GoalDay } from "@kit/api/types";
import { openSheet } from "@kit/app/ui";
import { KIND, GOAL_BEHIND, type CalItem } from "../calendar";
import { fmtDay } from "@kit/lib/format";
import { goalAutoNote } from "../goals";
import { EditDelete } from "@kit/components/contact";
import { toast } from "@kit/components/toast";
import { Meter } from "@kit/components/ui";
import { m as kit } from "@kit/messages";
import { m } from "../messages";

const PERCENT = 100;
/** Open items listed as carried to tomorrow */
const CARRY_SHOWN = 4;
/** Quick steps next to each goal */
const STEPS = [1, 5];

/** "Gün sonu": today's done, left and unplanned items, and what moves to tomorrow */
export function EndOfDay({ items }: { items: CalItem[] }) {
  const left = items.filter((e) => !e.done);
  const tiles = [
    { label: m.endOfDay.done, value: items.length - left.length, tone: "text-accent" },
    { label: m.endOfDay.left, value: left.length, tone: "" },
    { label: m.endOfDay.unplanned, value: items.filter((e) => !e.time).length, tone: "" },
  ];
  return (
    <section aria-label={m.endOfDay.title} className="flex flex-col gap-5 rounded-card border border-border-subtle bg-surface-1 p-10 rise">
      <h2 className="ff-card-title">{m.endOfDay.title}</h2>
      <div className="grid grid-cols-3 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-1 rounded-inner bg-surface-2 p-6">
            <span className="text-sm text-text-secondary">{t.label}</span>
            <span className={`text-2xl tracking-kpi ${t.tone}`}>{t.value}</span>
          </div>
        ))}
      </div>
      <span className="text-sm text-text-secondary">{m.endOfDay.carried}</span>
      {left.slice(0, CARRY_SHOWN).map((e) => (
        <div key={e.key} className="flex items-center gap-4 border-t border-border-subtle py-2 text-base-sm">
          <span className={`dash-dot ${KIND[e.kind].dot}`} />
          <span className="flex-grow">{e.title}</span>
          <span className="text-sm text-text-muted">{m.endOfDay.tomorrow}</span>
        </div>
      ))}
      {!left.length ? <span className="text-base-sm text-success">{m.endOfDay.allDone}</span> : null}
    </section>
  );
}

export interface WeekGoal {
  id: number;
  title: string;
  done: number;
  target: number;
}

/** One goal of the week: the weekly count and meter, and the logging of the picked day (steps with undo, day note, edit, delete) */
function GoalLine({ g, day, date }: { g: WeekGoal; day: GoalDay | undefined; date: string }) {
  const [more, setMore] = useState(false);
  const [note, setNote] = useState(day?.note ?? "");
  const log = (body: Record<string, unknown>) => run("post", `/goals/${g.id}/log`, { date, ...body }, { silent: true }).catch(() => {});
  const step = async (n: number) => {
    await log({ add: n });
    toast(m.delta(g.title, n), "ok", { label: kit.undo, run: () => void log({ add: -n }) });
  };
  const sub = day ? [m.weeklyGoals.daySub(fmtDay(date), day.done, day.target), goalAutoNote(day)].filter(Boolean).join(" · ") : "";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between text-base-sm">
        <span className="text-text-neutral-chip">{g.title}</span>
        <span className={`font-mono ${g.done / g.target < GOAL_BEHIND ? "text-warning" : "text-text-neutral-chip"}`}>{g.done} / {g.target}</span>
      </div>
      <Meter value={Math.min(PERCENT, (g.done / g.target) * PERCENT)} size="lg" label={g.title} />
      {day ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-xs text-text-muted">{sub}</span>
          <button type="button" className="btn btn-sec btn-sm" aria-label={m.delta(g.title, -1)} disabled={day.manual < 1} onClick={() => void step(-1)}>−1</button>
          {STEPS.map((n) => <button key={n} type="button" className="btn btn-pri btn-sm" aria-label={m.delta(g.title, n)} onClick={() => void step(n)}>+{n}</button>)}
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={more} aria-label={m.moreActions(g.title)} onClick={() => setMore(!more)}>⋯</button>
        </div>
      ) : null}
      {day && more ? (
        <div className="flex items-center gap-3">
          <input className="inp" value={note} placeholder={m.weeklyGoals.notePlaceholder} aria-label={m.weeklyGoals.noteLabel(g.title)}
            onChange={(e) => setNote(e.target.value)} onBlur={() => note.trim() !== (day.note ?? "") && void log({ note: note.trim() })} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
          <EditDelete label={kit.nouns.goal} onEdit={() => openSheet("goal", { edit: g.id })} onDelete={() => void remove(`/goals/${g.id}`, kit.nouns.goal).catch(() => {})} />
        </div>
      ) : null}
    </div>
  );
}

/** "Haftalık hedefler": every goal's count over the week; the buttons write to the picked day */
export function WeeklyGoals({ goals, dayGoals, date, dayLabel, streak }: {
  goals: WeekGoal[];
  dayGoals: GoalDay[];
  date: string;
  dayLabel: string;
  streak: number;
}) {
  return (
    <section aria-label={kit.nouns.goals} className="flex flex-col gap-6 rounded-card border border-border-subtle bg-surface-1 p-10 rise">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="ff-card-title flex-grow">{m.weeklyGoals.title}</h2>
        {streak ? <span className="text-sm text-text-muted">{m.weeklyGoals.streak(streak)}</span> : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("goal")}>{m.weeklyGoals.add}</button>
      </div>
      {goals.length ? <span className="-mt-3 text-xs text-text-muted">{m.weeklyGoals.plusGoesTo(dayLabel)}</span> : <p className="m-0 text-base-sm text-text-muted">{m.weeklyGoals.none}</p>}
      {goals.map((g) => <GoalLine key={`${g.id}-${date}`} g={g} day={dayGoals.find((d) => d.id === g.id)} date={date} />)}
    </section>
  );
}
