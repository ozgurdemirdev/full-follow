import { eq } from "drizzle-orm";
import {
  Bin, bool, eventLink as link, FFError, has, page, parse, requireRow, row, rows, schema, stamp, truncate, writeEvent as emit,
  type Ctx, type ListOpts, type NextTask, type TaskListRow,
} from "@fullfollow/core";
import { parseQuickTask } from "./quickAdd";
import { taskCreate, taskQuick, taskUpdate } from "./schemas";

const { tasks } = schema;

function checkTargets(ctx: Ctx, d: { person_id?: number | null; company_id?: number | null; opportunity_id?: number | null; project_id?: number | null }) {
  const set = [d.person_id, d.company_id, d.opportunity_id, d.project_id].filter(Boolean).length;
  if (set > 1) throw new FFError("validation", "görev en fazla bir kayda (kişi, firma, fırsat ya da proje) bağlanabilir");
  if (d.person_id) requireRow(ctx, "people", d.person_id);
  if (d.company_id) requireRow(ctx, "companies", d.company_id);
  if (d.opportunity_id) requireRow(ctx, "opportunities", d.opportunity_id);
  if (d.project_id) requireRow(ctx, "projects", d.project_id);
}

export function tasksService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(taskCreate, input);
    checkTargets(ctx, d);
    return ctx.db.transaction((tx) => {
      const r = tx.insert(tasks).values({ ...d, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "task.created", ...link(ctx, r), summary: `Görev eklendi (${r.assignee}): ${truncate(r.title, 60)}` });
      return { row: r, effects: [] as string[] };
    });
  }

  /** Task from the calendar quick add: { text, due_date? }; the time and the kind come out of the text */
  function quick(input: unknown) {
    const { text, ...rest } = parse(taskQuick, input);
    return create({ ...rest, ...parseQuickTask(text) });
  }

  function update(id: number, input: unknown) {
    const { done, ...f } = parse(taskUpdate, input);
    return ctx.db.transaction((tx) => {
      const cur = requireRow(ctx, "tasks", id);
      const merged = { person_id: cur.person_id, company_id: cur.company_id, opportunity_id: cur.opportunity_id, project_id: cur.project_id } as Record<string, number | null>;
      // bağlantı alanlarından biri değişiyorsa diğerleri temizlenir
      const targetKey = (["person_id", "company_id", "opportunity_id", "project_id"] as const).find((k) => f[k]);
      if (targetKey) for (const k of Object.keys(merged)) merged[k] = k === targetKey ? f[targetKey] ?? null : null;
      checkTargets(ctx, merged);
      const set: Record<string, unknown> = { ...f, ...(targetKey ? merged : {}), updated_at: ctx.clock.now() };
      if (done !== undefined) set.done_at = done ? (cur.done_at ?? ctx.clock.now()) : null;
      tx.update(tasks).set(set).where(eq(tasks.id, id)).run();
      if (done === true && !cur.done_at) emit(tx, ctx, { type: "task.done", ...link(ctx, cur), summary: `Görev tamamlandı: ${truncate(cur.title, 60)}` });
      return { row: requireRow(ctx, "tasks", id), effects: [] as string[] };
    });
  }

  function remove(id: number) {
    const cur = requireRow(ctx, "tasks", id);
    return ctx.db.transaction((tx) => {
      const bin = new Bin(ctx);
      bin.take("comments", "target_type = 'task' AND target_id = ?", id);
      bin.take("tasks", "id = ?", id);
      bin.commit(tx, "task", id, cur.title);
      emit(tx, ctx, { type: "task.deleted", ...link(ctx, cur), summary: `Görev silindi: ${truncate(cur.title, 60)}` });
      return { effects: [] as string[], trash: { type: "task", id } };
    });
  }

  /** Filters: all, done, assignee, overdue, due (due today or earlier), person_id, company_id, opportunity_id, project_id; open tasks by default */
  function list(o: ListOpts): { rows: TaskListRow[]; total: number } {
    const f = o.filter ?? {};
    const today = ctx.clock.today();
    let items = rows(ctx, `
      SELECT t.*, p.name AS person_name, co.name AS company_name, op.title AS opportunity_title, pr.name AS project_name
      FROM tasks t LEFT JOIN people p ON p.id = t.person_id LEFT JOIN companies co ON co.id = t.company_id LEFT JOIN opportunities op ON op.id = t.opportunity_id
      LEFT JOIN projects pr ON pr.id = t.project_id
      ORDER BY (t.due_date IS NULL), t.due_date, t.id`);
    const wantDone = bool(f.done);
    if (!bool(f.all)) items = items.filter((t) => (wantDone ? !!t.done_at : !t.done_at));
    if (f.assignee) items = items.filter((t) => t.assignee === f.assignee);
    if (bool(f.overdue)) items = items.filter((t) => t.due_date && t.due_date < today);
    if (bool(f.due)) items = items.filter((t) => t.due_date && t.due_date <= today);
    for (const k of ["person_id", "company_id", "opportunity_id", "project_id"]) if (f[k]) items = items.filter((t) => t[k] === Number(f[k]));
    items = items.filter((t) => has(o.q, t.title, t.person_name, t.company_name, t.opportunity_title, t.project_name));
    return page(items, o.limit, o.offset);
  }

  /** The open task of a project that is due first (undated ones last) */
  function next(projectId: number): NextTask | null {
    return row<NextTask>(ctx, "SELECT id, title, due_date, assignee, created_by FROM tasks WHERE project_id = ? AND done_at IS NULL ORDER BY (due_date IS NULL), due_date, id LIMIT 1", projectId) ?? null;
  }

  return { create, quick, update, remove, list, next };
}
