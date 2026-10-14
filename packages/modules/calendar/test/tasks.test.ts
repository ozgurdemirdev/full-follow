import { beforeEach, describe, expect, it } from "vitest";
import { FFError, openDb, type Clock } from "@fullfollow/core";
import { parseQuickTask } from "../src";
import { appFor, type TestApp } from "./helpers";

describe("Görev saati ve türü", () => {
  const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };
  let core: TestApp;
  beforeEach(() => {
    core = appFor(openDb(":memory:"), "ozgur", clock);
  });

  it("hızlı eklemede saat metnin başından ya da sonundan alınır, tür anahtar kelimeden gelir", () => {
    expect(parseQuickTask("14:00 Elif ile görüşme")).toEqual({ title: "Elif ile görüşme", due_time: "14:00", kind: "gorusme" });
    expect(parseQuickTask("Kerem dönüş 9.30")).toEqual({ title: "Kerem dönüş", due_time: "09:30", kind: "takip" });
    expect(parseQuickTask("Haftalık rapora göz at")).toEqual({ title: "Haftalık rapora göz at", due_time: null, kind: "gorev" });
    expect(parseQuickTask("25:00 yanlış saat").due_time).toBeNull();
    const r = core.tasks.quick({ text: "16:30 Mavi Ajans toplantı", due_date: "2026-10-15" }).row;
    expect(r).toMatchObject({ due_date: "2026-10-15", due_time: "16:30", kind: "gorusme", title: "Mavi Ajans toplantı" });
  });

  it("görevler projeye göre gruplanır: varsayılan açık olanlar, done ile bitenler de, proje adı projects modülü yokken null", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    h.sqlite.pragma("foreign_keys = OFF");
    const at = "2026-10-14T10:00:00Z";
    const add = (title: string, project: number | null, done: boolean, due: string | null) => h.sqlite.prepare(
      "INSERT INTO tasks (title, assignee, due_date, done_at, project_id, created_at, updated_at, created_by) VALUES (?, 'ozgur', ?, ?, ?, ?, ?, 'ozgur')",
    ).run(title, due, done ? at : null, project, at, at);
    add("b", 7, false, "2026-10-20");
    add("a", 7, false, "2026-10-15");
    add("bitti", 7, true, null);
    add("başka", 9, false, null);
    add("projesiz", null, false, null);
    const open = app.tasks.byProject();
    expect(open.map((g) => [g.project_id, g.project_name, g.tasks.map((t) => t.title)])).toEqual([[7, null, ["a", "b"]], [9, null, ["başka"]]]);
    expect(app.tasks.byProject({ done: true })[0].tasks.map((t) => t.title)).toEqual(["a", "b", "bitti"]);
    expect(app.tasks.byProject({ project_ids: [9] }).map((g) => g.project_id)).toEqual([9]);
  });

  it("saat HH:MM biçiminde 00:00 ile 23:59 arasında olmalı, tür listeden olmalı; takvim saatli görevleri öne alır", () => {
    expect(() => core.tasks.create({ title: "x", due_time: "24:00" })).toThrow(FFError);
    expect(() => core.tasks.create({ title: "x", due_time: "9:30" })).toThrow(FFError);
    expect(() => core.tasks.create({ title: "x", kind: "toplanti" })).toThrow(FFError);
    core.tasks.create({ title: "saatsiz", due_date: "2026-10-14" });
    core.tasks.create({ title: "öğleden sonra", due_date: "2026-10-14", due_time: "15:00", kind: "takip" });
    const b = core.tasks.create({ title: "sabah", due_date: "2026-10-14", due_time: "09:00" }).row;
    expect(core.tasks.update(b.id, { due_time: "" }).row.due_time).toBeNull();
    core.tasks.update(b.id, { due_time: "09:00" });
    const day = core.goals.calendar("2026-10-14", "2026-10-14")[0];
    expect(day.tasks.map((t) => t.title)).toEqual(["sabah", "öğleden sonra", "saatsiz"]);
    expect(day.tasks[1].kind).toBe("takip");
  });
});
