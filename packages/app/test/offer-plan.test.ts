import { beforeEach, expect, it } from "vitest";
import { openDb, type Clock, type DbHandle } from "@fullfollow/core";
import { appFor, suite, type TestApp } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

suite("offer lines, payment plan, project stage and last actor", () => {
  let h: DbHandle;
  let app: TestApp;
  const sql = <T = any>(q: string, ...a: unknown[]) => h.sqlite.prepare(q).all(...a) as T[];
  const won = (offer: Record<string, unknown>) => {
    const p = app.people.create({ name: "Ada" }).row;
    const src = app.get("source", "R10").row.id;
    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: src }).row;
    const created = app.offers.create({ opportunity_id: o.id, ...offer }).row;
    app.offers.update(created.id, { accepted: true });
    app.opportunities.move(o.id, { stage: "kazanildi" });
    return { o, offer: created };
  };
  beforeEach(() => {
    h = openDb(":memory:");
    app = appFor(h, "owner", clock);
  });

  it("the payment plan of the won offer splits the project's payments, rounding left over on the last part", () => {
    won({
      amount: 1005,
      plan: [{ key: "pesinat", label: "Peşinat", pct: 33 }, { key: "tasarim_onayi", label: "Tasarım onayı", pct: 33 }, { key: "teslim", label: "Teslim", pct: 34 }],
    });
    // round(1005 x 33 / 100) = 332 twice, the last part takes what is left: 341
    expect(sql("SELECT milestone, expected_amount FROM payments ORDER BY id")).toEqual([
      { milestone: "pesinat", expected_amount: 332 }, { milestone: "tasarim_onayi", expected_amount: 332 }, { milestone: "teslim", expected_amount: 341 },
    ]);
    expect(sql("SELECT SUM(expected_amount) s FROM payments")[0].s).toBe(1005);
  });

  it("an offer without a plan keeps the settings template", () => {
    won({ amount: 10000 });
    expect(sql("SELECT milestone, expected_amount FROM payments ORDER BY id")).toEqual([
      { milestone: "pesinat", expected_amount: 4000 }, { milestone: "tasarim_onayi", expected_amount: 3000 }, { milestone: "yayin", expected_amount: 3000 },
    ]);
  });

  it("a plan has to add up to 100, name each milestone once and stay inside the part limit", () => {
    const o = app.opportunities.create({ title: "Site", person_id: app.people.create({ name: "Ada" }).row.id, source_id: app.get("source", "R10").row.id }).row;
    const part = (key: string, pct: number) => ({ key, label: key, pct });
    expect(() => app.offers.create({ opportunity_id: o.id, amount: 100, plan: [part("pesinat", 50), part("teslim", 40)] })).toThrow(/100/);
    expect(() => app.offers.create({ opportunity_id: o.id, amount: 100, plan: [part("pesinat", 50), part("pesinat", 50)] })).toThrow(/bir kez/);
    expect(() => app.offers.create({ opportunity_id: o.id, amount: 100, plan: [part("pesinat", 100.5)] })).toThrow();
    const ok = app.offers.create({ opportunity_id: o.id, amount: 100, plan: [part("pesinat", 100)] }).row;
    expect(app.offers.update(ok.id, { plan: null }).row.plan).toBeNull();
  });

  it("an offer line has a quantity (default 1) and its line amount is quantity x unit price", () => {
    const o = app.opportunities.create({ title: "Site", person_id: app.people.create({ name: "Ada" }).row.id, source_id: app.get("source", "R10").row.id }).row;
    const r = app.offers.create({ opportunity_id: o.id, amount: 4800, items: [{ label: "Sayfa", amount: 1500, qty: 3 }, { label: "Kurulum", amount: 300 }] }).row;
    expect(r.items).toEqual([{ label: "Sayfa", amount: 1500, qty: 3, line: 4500 }, { label: "Kurulum", amount: 300, qty: 1, line: 300 }]);
    expect(() => app.offers.create({ opportunity_id: o.id, amount: 100, items: [{ label: "x", amount: 1, qty: 0 }] })).toThrow();
    // a row stored before quantities existed has no qty: it reads as 1
    h.sqlite.prepare("UPDATE offers SET items = ? WHERE id = ?").run(JSON.stringify([{ label: "Eski", amount: 700 }]), r.id);
    expect(app.get("offer", r.id).row.items).toEqual([{ label: "Eski", amount: 700, qty: 1, line: 700 }]);
  });

  it("a project can start at a later stage, a stage that does not exist is refused", () => {
    const p = app.people.create({ name: "Ada" }).row;
    const r = app.projects.create({ name: "Bakım işi", person_id: p.id, stage: "yayin" }).row;
    expect(r.stage).toBe("yayin");
    expect(app.projects.create({ name: "Varsayılan", person_id: p.id }).row.stage).toBe("pesinat");
    expect(() => app.projects.create({ name: "Hatalı", person_id: p.id, stage: "yok" })).toThrow();
  });

  it("a record read tells who made its latest change", () => {
    const p = app.people.create({ name: "Ada" }).row;
    expect(app.get("person", p.id).last_actor).toBe("owner");
    const claude = appFor(h, "claude", clock);
    claude.people.update(p.id, { role: "Kurucu" });
    expect(app.get("person", p.id).last_actor).toBe("claude");
    // other types look their events up by the id kept in the event data
    const t = claude.tasks.create({ title: "Ara" }).row;
    expect(app.get("task", t.id).last_actor).toBe("claude");
    app.tasks.update(t.id, { title: "Ara bakalım" });
    expect(app.get("task", t.id).last_actor).toBe("owner");
    // a record nobody has changed through the services has none
    h.sqlite.prepare("DELETE FROM events").run();
    expect(app.get("person", p.id).last_actor).toBeNull();
  });
});
