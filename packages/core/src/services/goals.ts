import { eq } from "drizzle-orm";
import { BULK_SKIPPED_EVENT } from "../constants";
import { addDays, daysBetween } from "../dates";
import { emit, FFError, parse, row, rows, stamp, type Ctx } from "../context";
import { daily_goals, goal_logs } from "../db/schema";
import { goalCreate, goalLogInput, goalUpdate } from "../schemas";
import { followUpsDue, paymentsDue, TASK_ORDER_SQL } from "./calendarFeed";
import { outgoingMessageCounts } from "./quota";
import { requireRow, truncate } from "./shared";
import { Bin } from "./trash";

interface GoalRow {
  id: number;
  title: string;
  target: number;
  days: string;
  channel: string | null;
  metric: string | null;
  note: string | null;
  created_at: string;
}

export interface GoalDay {
  id: number;
  title: string;
  target: number;
  channel: string | null;
  /** what the goal counts by itself instead of a channel (new_records) */
  metric: string | null;
  manual: number;
  auto: number;
  /** new_records goals: duplicates skipped by bulk saves that day */
  duplicates: number;
  done: number;
  complete: boolean;
  /** the day's note */
  note: string | null;
  /** the goal's permanent note */
  goal_note: string | null;
}

/** Longest calendar range in one call (about three months) */
const MAX_CALENDAR_DAYS = 92;
/** How far back the streak looks */
const STREAK_LOOKBACK_DAYS = 365;

/** ISO weekday: 1 = Monday ... 7 = Sunday */
export const isoWeekday = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
const mondayOf = (date: string) => addDays(date, -(isoWeekday(date) - 1));
/** A goal applies on a day if the weekday is in its repeat list and the goal already existed */
const appliesOn = (g: GoalRow, date: string) => g.days.split(",").includes(String(isoWeekday(date))) && date >= g.created_at.slice(0, 10);

/** New people and companies created per day (date → count); deleted records are gone from the tables, so they do not count */
function newRecordCounts(ctx: Ctx, from: string, to: string): Map<string, number> {
  const list = rows<{ d: string; n: number }>(ctx, `SELECT d, SUM(n) AS n FROM (
      SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM people GROUP BY d
      UNION ALL SELECT substr(created_at, 1, 10), COUNT(*) FROM companies GROUP BY 1
    ) WHERE d BETWEEN ? AND ? GROUP BY d`, from, to);
  return new Map(list.map((r) => [r.d, r.n]));
}

/** Duplicates skipped by bulk saves per day (date → count), from the bulk skipped events */
function skippedCounts(ctx: Ctx, from: string, to: string): Map<string, number> {
  const list = rows<{ d: string; n: number }>(ctx, `SELECT substr(created_at, 1, 10) AS d, SUM(json_extract(data, '$.count')) AS n FROM events
    WHERE type = ? AND substr(created_at, 1, 10) BETWEEN ? AND ? GROUP BY d`, BULK_SKIPPED_EVENT, from, to);
  return new Map(list.map((r) => [r.d, r.n]));
}

/** A goal counts by itself from a channel or from a metric, never both */
const assertOneCounter = (channel?: string | null, metric?: string | null) => {
  if (channel && metric) throw new FFError("validation", "hedef ya kanaldan ya da yeni kayıttan kendiliğinden sayar, ikisinden birden değil");
};

export function goalsService(ctx: Ctx) {
  const all = () => rows<GoalRow>(ctx, "SELECT * FROM daily_goals ORDER BY id");

  function logsBetween(from: string, to: string): Map<string, { count: number; note: string | null }> {
    const m = new Map<string, { count: number; note: string | null }>();
    for (const l of rows<{ goal_id: number; date: string; count: number; note: string | null }>(ctx, "SELECT goal_id, date, count, note FROM goal_logs WHERE date BETWEEN ? AND ?", from, to)) {
      m.set(`${l.goal_id}|${l.date}`, { count: l.count, note: l.note });
    }
    return m;
  }

  /** Goal state per day (from..to); days without applicable goals have an empty list */
  function days(from: string, to: string): { date: string; goals: GoalDay[] }[] {
    const goals = all();
    // outgoing messages on the goal's channel and new records count by themselves
    const auto = outgoingMessageCounts(ctx, from, to);
    const wantsRecords = goals.some((g) => g.metric === "new_records");
    const added = wantsRecords ? newRecordCounts(ctx, from, to) : new Map<string, number>();
    const skipped = wantsRecords ? skippedCounts(ctx, from, to) : new Map<string, number>();
    const logs = logsBetween(from, to);
    const out: { date: string; goals: GoalDay[] }[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const list = goals.filter((g) => appliesOn(g, d)).map((g) => {
        const log = logs.get(`${g.id}|${d}`);
        const a = g.metric === "new_records" ? (added.get(d) ?? 0) : g.channel ? (auto.get(`${g.channel}|${d}`) ?? 0) : 0;
        const manual = log?.count ?? 0;
        return { id: g.id, title: g.title, target: g.target, channel: g.channel, metric: g.metric, manual, auto: a, duplicates: g.metric === "new_records" ? (skipped.get(d) ?? 0) : 0, done: manual + a, complete: manual + a >= g.target, note: log?.note ?? null, goal_note: g.note };
      });
      out.push({ date: d, goals: list });
    }
    return out;
  }

  /** Streak: consecutive days up to today with every goal complete; an unfinished today does not break it, days without goals are skipped */
  function streak(today: string): number {
    const first = all().reduce((min, g) => (g.created_at.slice(0, 10) < min ? g.created_at.slice(0, 10) : min), today);
    const span = Math.min(STREAK_LOOKBACK_DAYS, daysBetween(first, today));
    const list = days(addDays(today, -span), today).reverse();
    let n = 0;
    for (const [i, d] of list.entries()) {
      if (!d.goals.length) continue;
      if (d.goals.every((g) => g.complete)) n++;
      else if (i > 0) break;
    }
    return n;
  }

  /** This week's (Monday to today) hit rate: sum(min(done, target)) / sum(target) */
  function weekRatio(today: string): number | null {
    const list = days(mondayOf(today), today);
    const target = list.reduce((s, d) => s + d.goals.reduce((x, g) => x + g.target, 0), 0);
    if (!target) return null;
    return list.reduce((s, d) => s + d.goals.reduce((x, g) => x + Math.min(g.done, g.target), 0), 0) / target;
  }

  /** The day's plan: goals plus tasks due that day (today also lists overdue open tasks) */
  function plan(date?: string) {
    const today = ctx.clock.today();
    const d = date ?? today;
    const goals = days(d, d)[0].goals;
    const tasks = rows(ctx, `SELECT id, title, assignee, due_date, due_time, kind, done_at FROM tasks
      WHERE due_date = ? OR (? = ? AND due_date < ? AND done_at IS NULL) ORDER BY done_at IS NOT NULL, due_date, ${TASK_ORDER_SQL}`, d, d, today, d);
    return { date: d, weekday: isoWeekday(d), goals, tasks, streak: streak(today), week_ratio: weekRatio(today) };
  }

  /** Calendar: goal fill rate, tasks (timed first), payments due and follow-ups due for every day in the range */
  function calendar(from: string, to: string) {
    if (from > to || daysBetween(from, to) >= MAX_CALENDAR_DAYS) throw new FFError("validation", `takvim aralığı en fazla ${MAX_CALENDAR_DAYS} gün olabilir`);
    const taskRows = rows<{ id: number; title: string; due_date: string; due_time: string | null; kind: string; done_at: string | null }>(ctx,
      `SELECT id, title, due_date, due_time, kind, done_at FROM tasks WHERE due_date BETWEEN ? AND ? ORDER BY ${TASK_ORDER_SQL}`, from, to);
    const payments = paymentsDue(ctx, from, to);
    const followUps = followUpsDue(ctx, from, to);
    return days(from, to).map((d) => {
      const target = d.goals.reduce((s, g) => s + g.target, 0);
      const done = d.goals.reduce((s, g) => s + Math.min(g.done, g.target), 0);
      return {
        ...d, tasks: taskRows.filter((t) => t.due_date === d.date), ratio: target ? done / target : null,
        payments: payments.filter((p) => p.due_date === d.date), follow_ups: followUps.filter((f) => f.date === d.date),
      };
    });
  }

  function create(input: unknown) {
    const d = parse(goalCreate, input);
    assertOneCounter(d.channel, d.metric);
    return ctx.db.transaction((tx) => {
      const r = tx.insert(daily_goals).values({ ...d, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "goal.created", summary: `Günlük hedef eklendi: ${truncate(r.title, 60)} (${r.target})`, data: { goal_id: r.id } });
      return { row: r, effects: [] as string[] };
    });
  }

  function update(id: number, input: unknown) {
    const d = parse(goalUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow<GoalRow>(ctx, "daily_goals", id, "hedef");
      assertOneCounter(d.channel === undefined ? cur.channel : d.channel, d.metric === undefined ? cur.metric : d.metric);
      if (Object.keys(d).length) {
        tx.update(daily_goals).set({ ...d, updated_at: ctx.clock.now() }).where(eq(daily_goals.id, id)).run();
        emit(tx, ctx, { type: "goal.updated", summary: `Günlük hedef düzenlendi: ${truncate(d.title ?? cur.title, 60)}`, data: { goal_id: id } });
      }
      return { row: requireRow(ctx, "daily_goals", id, "hedef"), effects: [] as string[] };
    });
  }

  function remove(id: number) {
    const cur = requireRow<GoalRow>(ctx, "daily_goals", id, "hedef");
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.take("goal_logs", "goal_id = ?", id);
      bin.take("daily_goals", "id = ?", id);
      bin.commit(tx, "goal", id, cur.title);
      emit(tx, ctx, { type: "goal.deleted", summary: `Günlük hedef silindi: ${truncate(cur.title, 60)}`, data: { goal_id: id } });
      return { effects: [] as string[], trash: { type: "goal", id } };
    });
  }

  /** A day's progress: add = on top of the count (never below 0), count = set it, note = day note. Date defaults to today. */
  function log(input: unknown) {
    const d = parse(goalLogInput, input);
    if (d.add === undefined && d.count === undefined && d.note === undefined) throw new FFError("validation", "add, count ya da note gerekli");
    if (d.add !== undefined && d.count !== undefined) throw new FFError("validation", "add ve count birlikte verilmez");
    const date = d.date ?? ctx.clock.today();
    return ctx.db.transaction((tx) => {
      const goal = requireRow<GoalRow>(ctx, "daily_goals", d.goal_id, "hedef");
      const cur = row<{ id: number; count: number }>(ctx, "SELECT id, count FROM goal_logs WHERE goal_id = ? AND date = ?", goal.id, date);
      const counted = d.add !== undefined || d.count !== undefined;
      const count = d.count ?? Math.max(0, (cur?.count ?? 0) + (d.add ?? 0));
      const set = { count: counted ? count : (cur?.count ?? 0), ...(d.note !== undefined ? { note: d.note || null } : {}) };
      if (cur) tx.update(goal_logs).set({ ...set, updated_at: ctx.clock.now() }).where(eq(goal_logs.id, cur.id)).run();
      else tx.insert(goal_logs).values({ goal_id: goal.id, date, ...set, ...stamp(ctx) }).run();
      const state = days(date, date)[0].goals.find((g) => g.id === goal.id);
      if (counted) {
        emit(tx, ctx, { type: "goal.progress", summary: `${truncate(goal.title, 40)}: ${state?.done ?? set.count}/${goal.target} (${date})`, data: { goal_id: goal.id, date } });
      }
      return { row: row(ctx, "SELECT * FROM goal_logs WHERE goal_id = ? AND date = ?", goal.id, date), effects: state ? [`${state.done}/${state.target}${state.complete ? " tamam" : ""}`] : [] };
    });
  }

  /** Every goal with today's state */
  function list() {
    const today = ctx.clock.today();
    const state = new Map(days(today, today)[0].goals.map((g) => [g.id, g]));
    return all().map((g) => ({ ...g, today: state.get(g.id) ?? null }));
  }

  return { create, update, remove, log, plan, calendar, list };
}
