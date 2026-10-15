import { eq } from "drizzle-orm";
import {
  Bin, bool, eventLink as link, FFError, has, page, parse, requireRow, row, rows, schema, stamp, truncate, writeEvent as emit,
  type Ctx, type ListOpts, type NextTask, type OpenProjectTask, type ProjectTasks, type TaskListRow, type TaskRecord,
} from "@fullfollow/core";
import { m } from "../messages";
import { EVENT_TITLE_CHARS } from "./constants";
import { parseQuickTask } from "./quickAdd";
import { taskCreate, taskQuick, taskUpdate } from "./schemas";

const { tasks } = schema;

/** The record a task can hang on: at most one of them */
const TARGET_KEYS = ["person_id", "company_id", "opportunity_id", "project_id", "idea_id"] as const;

function checkTargets(ctx: Ctx, d: Partial<Record<(typeof TARGET_KEYS)[number], number | null>>) {
  const set = TARGET_KEYS.filter((k) => d[k]).length;
  if (set > 1) throw new FFError("validation", m.errors.oneTarget);
  if (d.person_id) requireRow(ctx, "people", d.person_id);
  if (d.company_id) requireRow(ctx, "companies", d.company_id);
  // opportunities come from the pipeline module, projects from the projects module (a link to one that is not installed is refused)
  if (d.opportunity_id) {
    if (!ctx.mod("pipeline")) throw new FFError("validation", m.errors.moduleMissing(m.opportunityNoun, d.opportunity_id, "pipeline"));
    if (!ctx.mod("pipeline")!.opportunities.ref(d.opportunity_id)) throw new FFError("not_found", m.errors.notFound(m.opportunityNoun, d.opportunity_id));
  }
  if (d.project_id) {
    if (!ctx.mod("projects")) throw new FFError("validation", m.errors.moduleMissing(m.projectNoun, d.project_id, "projects"));
    if (!ctx.mod("projects")!.projects.ref(d.project_id)) throw new FFError("not_found", m.errors.notFound(m.projectNoun, d.project_id));
  }
  if (d.idea_id) {
    if (!ctx.mod("ideas")) throw new FFError("validation", m.errors.moduleMissing(m.ideaNoun, d.idea_id, "ideas"));
    if (!ctx.mod("ideas")!.ref(d.idea_id)) throw new FFError("not_found", m.errors.notFound(m.ideaNoun, d.idea_id));
  }
}

export function tasksService(ctx: Ctx) {
  function create(input: unknown) {
    const d = parse(taskCreate, input);
    checkTargets(ctx, d);
    return ctx.db.transaction((tx) => {
      const r = tx.insert(tasks).values({ ...d, ...stamp(ctx) }).returning().get();
      emit(tx, ctx, { type: "task.created", ...link(ctx, r), summary: m.events.taskAdded(r.assignee, truncate(r.title, EVENT_TITLE_CHARS)), data: { task_id: r.id } });
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
      const merged = Object.fromEntries(TARGET_KEYS.map((k) => [k, cur[k]])) as Record<string, number | null>;
      // bağlantı alanlarından biri değişiyorsa diğerleri temizlenir
      const targetKey = TARGET_KEYS.find((k) => f[k]);
      if (targetKey) for (const k of Object.keys(merged)) merged[k] = k === targetKey ? f[targetKey] ?? null : null;
      checkTargets(ctx, merged);
      const set: Record<string, unknown> = { ...f, ...(targetKey ? merged : {}), updated_at: ctx.clock.now() };
      if (done !== undefined) set.done_at = done ? (cur.done_at ?? ctx.clock.now()) : null;
      tx.update(tasks).set(set).where(eq(tasks.id, id)).run();
      if (Object.keys(f).length) emit(tx, ctx, { type: "task.updated", ...link(ctx, { person_id: merged.person_id, opportunity_id: merged.opportunity_id, project_id: merged.project_id }), summary: m.events.taskUpdated(truncate(f.title ?? cur.title, EVENT_TITLE_CHARS)), data: { task_id: id } });
      if (done === true && !cur.done_at) emit(tx, ctx, { type: "task.done", ...link(ctx, cur), summary: m.events.taskDone(truncate(cur.title, EVENT_TITLE_CHARS)), data: { task_id: id } });
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
      emit(tx, ctx, { type: "task.deleted", ...link(ctx, cur), summary: m.events.taskDeleted(truncate(cur.title, EVENT_TITLE_CHARS)), data: { task_id: id } });
      return { effects: [] as string[], trash: { type: "task", id } };
    });
  }

  /** Filters: all, done, assignee, overdue, due (due today or earlier), person_id, company_id, opportunity_id, project_id, idea_id; open tasks by default */
  function list(o: ListOpts): { rows: TaskListRow[]; total: number } {
    const f = o.filter ?? {};
    const today = ctx.clock.today();
    let items = rows(ctx, `
      SELECT t.*, p.name AS person_name, co.name AS company_name
      FROM tasks t LEFT JOIN people p ON p.id = t.person_id LEFT JOIN companies co ON co.id = t.company_id
      ORDER BY (t.due_date IS NULL), t.due_date, t.id`);
    // the titles of opportunities and names of projects come from their modules (null without them)
    const titles = ctx.mod("pipeline")?.opportunities.titles(items.flatMap((t) => (t.opportunity_id ? [t.opportunity_id as number] : [])));
    const names = ctx.mod("projects")?.projects.names(items.flatMap((t) => (t.project_id ? [t.project_id as number] : [])));
    const ideas = ctx.mod("ideas");
    items = items.map((t) => ({
      ...t, opportunity_title: titles?.get(t.opportunity_id) ?? null, project_name: names?.get(t.project_id) ?? null,
      idea_title: (t.idea_id && ideas?.ref(t.idea_id)?.title) || null,
    }));
    const wantDone = bool(f.done);
    if (!bool(f.all)) items = items.filter((t) => (wantDone ? !!t.done_at : !t.done_at));
    if (f.assignee) items = items.filter((t) => t.assignee === f.assignee);
    if (bool(f.overdue)) items = items.filter((t) => t.due_date && t.due_date < today);
    if (bool(f.due)) items = items.filter((t) => t.due_date && t.due_date <= today);
    for (const k of TARGET_KEYS) if (f[k]) items = items.filter((t) => t[k] === Number(f[k]));
    items = items.filter((t) => has(o.q, t.title, t.person_name, t.company_name, t.opportunity_title, t.project_name, t.idea_title));
    return page(items, o.limit, o.offset);
  }

  /** Tasks grouped by project (by due date, undated last): the open ones, the done ones too with `done`, of the given projects or of every project that has any */
  function byProject(o: { project_ids?: number[]; done?: boolean } = {}): ProjectTasks[] {
    const only = o.project_ids?.length ? JSON.stringify(o.project_ids) : null;
    const items = rows<TaskRecord>(ctx, `SELECT * FROM tasks WHERE project_id IS NOT NULL AND (? IS NULL OR project_id IN (SELECT value FROM json_each(?)))${o.done ? "" : " AND done_at IS NULL"}
      ORDER BY project_id, (due_date IS NULL), due_date, id`, only, only);
    // names come from the projects module (null without it); a task hangs on a project only, so no other record names
    const names = ctx.mod("projects")?.projects.names([...new Set(items.map((t) => t.project_id as number))]);
    const groups = new Map<number, ProjectTasks>();
    for (const t of items) {
      const id = t.project_id as number;
      const name = names?.get(id) ?? null;
      const group = groups.get(id) ?? { project_id: id, project_name: name, tasks: [] };
      group.tasks.push({ ...t, person_name: null, company_name: null, opportunity_title: null, project_name: name, idea_title: null });
      groups.set(id, group);
    }
    return [...groups.values()];
  }

  /** The open task of a project that is due first (undated ones last) */
  function next(projectId: number): NextTask | null {
    return row<NextTask>(ctx, "SELECT id, title, due_date, assignee, created_by FROM tasks WHERE project_id = ? AND done_at IS NULL ORDER BY (due_date IS NULL), due_date, id LIMIT 1", projectId) ?? null;
  }

  /** The open tasks of these projects in one statement (the ids travel as JSON), due first, undated last */
  function openOfProjects(projectIds: number[]): Map<number, OpenProjectTask[]> {
    const out = new Map<number, OpenProjectTask[]>();
    if (!projectIds.length) return out;
    const list = rows<OpenProjectTask & { project_id: number }>(ctx, `SELECT id, project_id, assignee, due_date FROM tasks
      WHERE done_at IS NULL AND project_id IN (SELECT value FROM json_each(?)) ORDER BY (due_date IS NULL), due_date, id`, JSON.stringify(projectIds));
    for (const { project_id, ...t } of list) out.set(project_id, [...(out.get(project_id) ?? []), t]);
    return out;
  }

  return { create, quick, update, remove, list, byProject, next, openOfProjects };
}
