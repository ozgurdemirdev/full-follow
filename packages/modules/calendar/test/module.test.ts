import { describe, expect, it } from "vitest";
import { openDb, type Clock } from "@fullfollow/core";
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

  it("the Today view carries the day plan and the tasks due", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    app.tasks.create({ title: "bugün", due_date: "2026-10-14" });
    const today = app.today();
    expect(today.plan).toMatchObject({ date: "2026-10-14", goals: [] });
    expect(today.tasks).toMatchObject({ total: 1, rows: [{ title: "bugün" }] });
  });

  it("a project's next task comes from the module", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    // the people module is not installed here: a bare row is all the opportunity needs
    const personId = Number(h.sqlite.prepare("INSERT INTO people (name, created_at, updated_at, created_by) VALUES ('Ada', ?, ?, 'ozgur')").run(clock.now(), clock.now()).lastInsertRowid);
    const o = app.opportunities.create({ title: "Site", person_id: personId, source_id: app.get("source", "R10").row.id }).row;
    app.opportunities.move(o.id, { stage: "kazanildi" });
    const projectId = app.find("project").rows[0].id;
    app.tasks.create({ title: "tasarım", project_id: projectId, due_date: "2026-10-20" });
    expect(app.find("project").rows[0].next_task).toMatchObject({ title: "tasarım" });
  });
});
