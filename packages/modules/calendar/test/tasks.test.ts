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
