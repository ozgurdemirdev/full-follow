import { eq } from "drizzle-orm";
import { emit, FFError, parse, stamp, type Ctx } from "../context";
import { tasks } from "../db/schema";
import { taskCreate, taskUpdate } from "../schemas";
import { link, requireRow, truncate } from "./shared";
import { Bin } from "./trash";

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

  return { create, update, remove };
}
