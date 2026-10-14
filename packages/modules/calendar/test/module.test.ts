import { describe, expect, it } from "vitest";
import { createCore, FFError, openDb, type Clock } from "@fullfollow/core";
import { appFor } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

describe("calendar as a module", () => {
  it("tasks, goals and progress go through the generic save, find, get and delete, by their Turkish aliases", () => {
    const app = appFor(openDb(":memory:"), "claude", clock);
    const t = app.save("gorev", { title: "teklif hazırla", due_date: "2026-10-14" }).row;
    expect(app.get("task", t.id).row).toMatchObject({ title: "teklif hazırla", created_by: "claude" });
    app.save("task", { done: true }, t.id);
    expect(app.find("task").total).toBe(0);
    expect(app.find("görev", { filter: { done: true } }).total).toBe(1);
    const g = app.save("hedef", { title: "Mail", target: 3 }).row;
    expect(app.save("ilerleme", { goal: "Mail", add: 2 }).effects).toEqual(["2/3"]);
    expect(app.get("goal", g.id).row).toMatchObject({ title: "Mail", today: { done: 2 } });
    expect(app.find("goal_log").rows[0]).toMatchObject({ goal_id: g.id, count: 2 });
    expect(() => app.remove("goal_log", 1)).toThrow(/ilerleme silinmez/);
    expect(app.remove("task", t.id).trash).toEqual({ type: "task", id: t.id });
    expect(app.find("trash").rows[0]).toMatchObject({ type: "task", what: "görev" });
    app.restore("task", t.id);
    expect(app.get("task", t.id).row.title).toBe("teklif hazırla");
  });

  it("a person, opportunity or project lists its tasks through the module's relation", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    const p = app.people.create({ name: "Ada" }).row;
    app.tasks.create({ title: "ara", person_id: p.id });
    app.tasks.create({ title: "başkası" });
    expect(app.get("person", p.id, ["tasks"]).related.tasks.map((t: any) => t.title)).toEqual(["ara"]);
    expect(app.get("person", p.id, ["touches"]).related.touches).toEqual([]);
  });

  it("the Today view carries the day plan and the tasks due", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    app.tasks.create({ title: "bugün", due_date: "2026-10-14" });
    const today = app.today();
    expect(today.plan).toMatchObject({ date: "2026-10-14", goals: [] });
    expect(today.tasks).toMatchObject({ total: 1, rows: [{ title: "bugün" }] });
  });

  it("without the module the rest keeps working: no plan or tasks in Today, a clear error for its types, no relation", () => {
    const app = createCore(openDb(":memory:"), "ozgur", clock);
    const p = app.people.create({ name: "Ada" }).row;
    expect(app.today()).not.toHaveProperty("plan");
    expect(app.today()).not.toHaveProperty("tasks");
    expect(() => app.save("task", { title: "x" })).toThrow(/"task" türü için "calendar" modülü kurulu değil/);
    expect(() => app.find("gorev")).toThrow(FFError);
    expect(() => app.get("person", p.id, ["tasks"])).toThrow(/geçerli ilişkiler/);
    expect(app.queries.projects({}).rows).toEqual([]);
    expect(app.mod("calendar")).toBeUndefined();
  });

  it("tasks follow a person to the trash and back; the link from a company or opportunity is emptied and restored", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    const sql = (q: string, ...a: unknown[]) => app.ctx.sqlite.prepare(q).all(...a) as any[];
    const p = app.people.create({ name: "Ada" }).row;
    const task = app.tasks.create({ title: "ara", person_id: p.id }).row;
    app.save("comment", { target_type: "task", target_id: task.id, body: "not" });
    app.remove("person", p.id);
    expect(sql("SELECT COUNT(*) n FROM tasks")[0].n).toBe(0);
    expect(sql("SELECT COUNT(*) n FROM comments")[0].n).toBe(0);
    app.restore("person", p.id);
    expect(sql("SELECT id FROM tasks").map((r) => r.id)).toEqual([task.id]);
    expect(sql("SELECT COUNT(*) n FROM comments")[0].n).toBe(1);

    const c = app.companies.create({ name: "ABC" }).row;
    const ct = app.tasks.create({ title: "firma işi", company_id: c.id }).row;
    app.remove("company", c.id);
    expect(sql("SELECT company_id FROM tasks WHERE id = ?", ct.id)[0].company_id).toBeNull();
    app.restore("company", c.id);
    expect(sql("SELECT company_id FROM tasks WHERE id = ?", ct.id)[0].company_id).toBe(c.id);

    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: app.get("source", "R10").row.id }).row;
    const ot = app.tasks.create({ title: "teklif", opportunity_id: o.id }).row;
    app.remove("opportunity", o.id);
    expect(sql("SELECT opportunity_id FROM tasks WHERE id = ?", ot.id)[0].opportunity_id).toBeNull();
    app.restore("opportunity", o.id);
    expect(sql("SELECT opportunity_id FROM tasks WHERE id = ?", ot.id)[0].opportunity_id).toBe(o.id);
  });

  it("a project's next task comes from the module and is null without it", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    const p = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: app.get("source", "R10").row.id }).row;
    app.opportunities.move(o.id, { stage: "kazanildi" });
    const projectId = app.find("project").rows[0].id;
    app.tasks.create({ title: "tasarım", project_id: projectId, due_date: "2026-10-20" });
    expect(app.find("project").rows[0].next_task).toMatchObject({ title: "tasarım" });
  });
});
