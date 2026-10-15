import { beforeEach, expect, it, vi } from "vitest";
import { addDays, dayOf, FFError, openDb, type Clock, type DbHandle } from "@fullfollow/core";
import { appFor, suite, type TestApp } from "./helpers";

let today = "2026-10-15";
let now = "2026-10-15T10:00:00Z";
const clock: Clock = { today: () => today, now: () => now };

suite("the fixes of the service review", () => {
  let h: DbHandle;
  let app: TestApp;
  const sql = (q: string, ...a: unknown[]) => h.sqlite.prepare(q).all(...a) as any[];
  beforeEach(() => {
    today = "2026-10-15";
    now = "2026-10-15T10:00:00Z";
    h = openDb(":memory:");
    app = appFor(h, "ozgur", clock);
  });

  it("the drafts list looks up the company names in one call, not one company at a time", () => {
    const a = app.companies.create({ name: "Acme" }).row;
    const b = app.companies.create({ name: "Beta" }).row;
    for (const company of [a, b]) {
      const p = app.people.create({ name: `K ${company.name}`, company_id: company.id }).row;
      app.drafts.create({ person_id: p.id, channel: "email", body: "x" });
    }
    const companies = app.mod("companies")!;
    const one = vi.spyOn(companies, "get");
    const names = vi.spyOn(companies, "names");
    expect(app.drafts.list({}).rows.map((d) => d.company_name).sort()).toEqual(["Acme", "Beta"]);
    expect(one).not.toHaveBeenCalled();
    expect(names).toHaveBeenCalledTimes(1);
    expect(companies.names([a.id, b.id, 9999])).toEqual(new Map([[a.id, "Acme"], [b.id, "Beta"]]));
  });

  it("a single person or company read asks the network for that record only, and the list filters narrow in SQL", () => {
    const co = app.companies.create({ name: "Acme" }).row;
    const ada = app.people.create({ name: "Ada", company_id: co.id }).row;
    const bob = app.people.create({ name: "Bob" }).row;
    app.touches.create({ person_id: ada.id, channel: "email", direction: "giden", kind: "mesaj", summary: "merhaba" });
    app.touches.create({ person_id: bob.id, channel: "email", direction: "giden", kind: "mesaj", summary: "selam" });
    const network = app.mod("network")!;
    const stats = vi.spyOn(network, "stats");
    const rhythm = vi.spyOn(network, "rhythm");
    const people = app.mod("people")!;
    expect(people.get(ada.id)).toMatchObject({ name: "Ada", company_name: "Acme", awaiting: expect.any(Object) });
    expect(people.get(9999)).toBeUndefined();
    expect(people.card(ada.id).row.id).toBe(ada.id);
    expect(app.get("person", ada.id).row.id).toBe(ada.id);
    expect(people.list({ filter: { company_id: co.id } }).rows.map((p) => p.name)).toEqual(["Ada"]);
    for (const call of [...stats.mock.calls, ...rhythm.mock.calls]) expect(call[0]).toBeDefined();
    expect(stats).toHaveBeenCalled();
    expect(people.list({}).total).toBe(2);
    expect(stats.mock.calls.at(-1)![0]).toBeUndefined();
    expect(app.mod("companies")!.get(co.id)).toMatchObject({ name: "Acme", people_count: 1 });
    expect(app.mod("companies")!.get(9999)).toBeUndefined();
    // the network numbers of one person equal those of the whole list
    expect(network.stats([ada.id]).get(ada.id)).toEqual(network.stats().get(ada.id));
    expect(network.stats([ada.id]).size).toBe(1);
    expect(network.rhythm([bob.id]).get(bob.id)).toEqual(network.rhythm().get(bob.id));
    expect([...network.rhythm([bob.id]).keys()]).toEqual([bob.id]);
  });

  it("the touch list cuts its filters and its page in SQL and still counts the whole filtered set", () => {
    const ada = app.people.create({ name: "Ada" }).row;
    const bob = app.people.create({ name: "Bob" }).row;
    for (let i = 0; i < 5; i++) app.touches.create({ person_id: ada.id, channel: i % 2 ? "email" : "telefon", direction: "giden", kind: "mesaj", summary: `ada ${i}`, happened_at: `2026-10-0${i + 1}T09:00:00Z` });
    app.touches.create({ person_id: bob.id, channel: "email", direction: "gelen", kind: "mesaj", summary: "bob" });
    app.touches.create({ contact: "x@y.com", channel: "email", direction: "gelen", kind: "mesaj", summary: "loose" });
    const t = app.mod("network")!.touches;
    const adas = t.list({ filter: { person_id: ada.id }, limit: 2, offset: 1 });
    expect(adas.total).toBe(5);
    expect(adas.rows.map((r) => r.summary)).toEqual(["ada 3", "ada 2"]);
    expect(t.list({ filter: { person_id: ada.id, channel: "email" } }).total).toBe(2);
    expect(t.list({ filter: { loose: true } }).rows.map((r) => r.summary)).toEqual(["loose"]);
    expect(t.list({ q: "ADA", limit: 3 })).toMatchObject({ total: 5 });
    expect(t.list({ limit: 100 }).total).toBe(7);
    expect(t.get(1)).toMatchObject({ summary: "ada 0", person_name: "Ada" });
  });

  it("opportunity, offer and core record reads by id filter in SQL and return the same rows", () => {
    const src = (app.get("source", "R10") as any).row;
    const ada = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "A", person_id: ada.id, source_id: src.id, estimated_value: 1000 }).row;
    app.opportunities.create({ title: "B", person_id: ada.id, source_id: src.id });
    const pipeline = app.mod("pipeline")!;
    expect(pipeline.opportunities.list({ filter: { person_id: ada.id, stage: "bulundu" } }).total).toBe(2);
    expect(pipeline.opportunities.list({ filter: { company_id: 9999 } }).total).toBe(0);
    expect(pipeline.opportunities.list({ filter: { open: true, source_id: src.id }, limit: 1 })).toMatchObject({ total: 2 });
    app.offers.create({ opportunity_id: o.id, amount: 1000, plan: [{ key: "pesinat", label: "Peşinat", pct: 100 }] });
    expect(pipeline.offers.list({ filter: { opportunity_id: o.id } }).total).toBe(1);
    expect(pipeline.offers.list({ filter: { opportunity_id: o.id + 1 } }).total).toBe(0);
    const note = sql("INSERT INTO notes(person_id, body, created_by, created_at, updated_at) VALUES (?, 'n1', 'ozgur', ?, ?) RETURNING id", ada.id, now, now)[0];
    expect(app.get("note", note.id).row).toMatchObject({ body: "n1", person_name: "Ada" });
    expect(app.find("note", { filter: { person_id: ada.id } }).total).toBe(1);
    expect(app.get("source", src.id).row.id).toBe(src.id);
    const sector = app.save("sector", { name: "Sağlık" }).row;
    expect(app.get("sector", sector.id).row.id).toBe(sector.id);
    const tag = app.save("tag", { name: "Sıcak lead" }).row;
    expect(app.get("tag", tag.id).row.id).toBe(tag.id);
    expect(() => app.get("note", 9999)).toThrow(/bulunamadı/);
  });

  it("a cancelled project's unpaid payments are not due, overdue, waited for or on the calendar", () => {
    const src = (app.get("source", "R10") as any).row;
    const co = app.companies.create({ name: "Acme" }).row;
    const ada = app.people.create({ name: "Ada", company_id: co.id }).row;
    const o = app.opportunities.create({ title: "X", person_id: ada.id, source_id: src.id, estimated_value: 10000 }).row;
    app.opportunities.move(o.id, { stage: "kazanildi" });
    const pr = sql("SELECT id FROM projects")[0];
    h.sqlite.prepare("UPDATE payments SET due_date = '2026-10-10' WHERE project_id = ?").run(pr.id);
    const projects = app.mod("projects")!;
    const figures = () => ({
      outstanding: projects.outstandingDue("2026-10"),
      overdue: projects.payments.list({ filter: { overdue: true } }).total,
      unpaid: projects.payments.list({ filter: { unpaid: true } }).total,
      soon: projects.payments.list({ filter: { due_within_days: 30 } }).total,
      late: projects.payments.list({ filter: { status: "gecikmis" } }).total,
      calendar: projects.payments.due("2026-10-01", "2026-10-31").length,
      companyDue: projects.moneyByCompany().get(co.id)!.due,
      waiting: projects.projects.get(pr.id)!.waiting,
    });
    const before = figures();
    expect(before).toMatchObject({ outstanding: 10000, companyDue: 10000, waiting: "gecikti" });
    expect(before.overdue).toBeGreaterThan(0);
    app.projects.move(pr.id, { stage: "iptal" });
    expect(figures()).toEqual({ outstanding: 0, overdue: 0, unpaid: 0, soon: 0, late: 0, calendar: 0, companyDue: 0, waiting: null });
    expect(projects.payments.list({ filter: { project_id: pr.id } }).total).toBe(before.unpaid);
    expect(projects.projects.get(pr.id)!.next_payment).toBeNull();
  });

  it("every daily bucket of a timestamp uses the local day: a message sent near midnight UTC counts on the day the clock shows", () => {
    // 21:30 UTC is already the next day wherever the offset is positive (Istanbul); the expected day is computed, so the test also holds at UTC
    const sentAt = "2026-10-11T21:30:00Z";
    const day = dayOf(sentAt);
    now = "2026-10-01T10:00:00Z";
    const goal = app.goals.create({ title: "Mesaj", target: 1, channel: "email" }).row;
    const records = app.goals.create({ title: "Kayıt", target: 1, metric: "new_records" }).row;
    now = sentAt;
    today = day;
    const ada = app.people.create({ name: "Ada" }).row;
    app.touches.create({ person_id: ada.id, channel: "email", direction: "giden", kind: "mesaj", summary: "merhaba" });
    expect(app.quota(day).channels.find((c) => c.channel === "email")!.sent).toBe(1);
    expect((app.today(10) as any).week.sent).toBe(1);
    const plan = app.goals.plan(day).goals;
    expect(plan.find((g) => g.id === goal.id)).toMatchObject({ auto: 1, complete: true });
    expect(plan.find((g) => g.id === records.id)).toMatchObject({ auto: 1 });
    expect(app.mod("drafts")!.outgoingMessageCounts(day, day).get(`email|${day}`)).toBe(1);
    // the channel numbers look back a fixed number of days from today: the message is exactly on the first day
    today = addDays(day, 30);
    now = `${today}T10:00:00Z`;
    expect(app.mod("reports")!.marketing().channels.find((c) => c.channel === "email")).toMatchObject({ people: 1, sent: 1 });
  });

  it("Today's follow-ups drop a person or opportunity that was contacted after the follow-up date, with the same rule as the calendar feed", () => {
    const src = (app.get("source", "R10") as any).row;
    const ada = app.people.create({ name: "Ada", next_follow_up_at: "2026-10-10" }).row;
    const bob = app.people.create({ name: "Bob", next_follow_up_at: "2026-10-10" }).row;
    const o = app.opportunities.create({ title: "O", person_id: ada.id, source_id: src.id, next_follow_up_at: "2026-10-10" }).row;
    const due = () => {
      const f = (app.today(10) as any).follow_ups;
      return { people: f.people.rows.map((p: any) => p.name), opportunities: f.opportunities.rows.map((x: any) => x.title) };
    };
    expect(due()).toEqual({ people: ["Ada", "Bob"], opportunities: ["O"] });
    app.touches.create({ person_id: ada.id, opportunity_id: o.id, channel: "email", direction: "giden", kind: "mesaj", summary: "takip", happened_at: "2026-10-12T09:00:00Z" });
    expect(due()).toEqual({ people: ["Bob"], opportunities: [] });
    const feed = app.goals.calendar("2026-10-10", "2026-10-10")[0].follow_ups.map((f: any) => [f.type, f.name, f.done]);
    expect(feed).toEqual(expect.arrayContaining([["person", "Ada", true], ["person", "Bob", false], ["opportunity", "O", true]]));
    expect(app.mod("people")!.list({ filter: { follow_up_due: true } }).rows.map((p) => p.id)).toEqual([bob.id]);
    // a touch from before the date does not finish it
    const early = app.people.create({ name: "Cem", next_follow_up_at: "2026-10-14" }).row;
    app.touches.create({ person_id: early.id, channel: "email", direction: "giden", kind: "mesaj", summary: "once", happened_at: "2026-10-13T09:00:00Z" });
    expect(due().people).toEqual(["Bob", "Cem"]);
  });

  it("the week strip and the reports count the money received the same way: by payment date, with corrections", () => {
    const src = (app.get("source", "R10") as any).row;
    const ada = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "O", person_id: ada.id, source_id: src.id, estimated_value: 10000 }).row;
    app.opportunities.move(o.id, { stage: "kazanildi" });
    const pay = sql("SELECT id FROM payments WHERE milestone = 'pesinat'")[0];
    const timeline = app.mod("timeline")!;
    const reports = app.mod("reports")!;
    // the payment is entered today but dated in September: it belongs to the September report, not to this week
    app.payments.pay(pay.id, 1000, "2026-09-20");
    expect(reports.month("2026-09").collected).toBe(1000);
    expect(timeline.week().collections_amount).toBe(0);
    app.payments.pay(pay.id, 500, "2026-10-14");
    expect(timeline.week().collections_amount).toBe(500);
    expect(reports.month("2026-10").collected).toBe(500);
    // a correction moves the amount in both
    app.payments.update(pay.id, { paid_amount: 400, paid_at: "2026-10-13" });
    expect(timeline.week().collections_amount).toBe(400);
    expect(reports.month("2026-10").collected).toBe(400);
    expect(reports.month("2026-09").collected).toBe(0);
    expect(app.mod("projects")!.collectedBetween("2026-10-12", "2026-10-18")).toBe(400);
  });

  it("a payment plan, an offer's or the settings template, needs exactly one deposit so a project is never stuck at it", () => {
    const src = (app.get("source", "R10") as any).row;
    const ada = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "O", person_id: ada.id, source_id: src.id, estimated_value: 10000 }).row;
    const noDeposit = [{ key: "teslim", label: "Teslim", pct: 100 }];
    expect(() => app.offers.create({ opportunity_id: o.id, amount: 10000, plan: noDeposit })).toThrow(/peşinat tam bir kez/);
    const off = app.offers.create({ opportunity_id: o.id, amount: 10000, plan: [{ key: "pesinat", label: "Peşinat", pct: 40 }, { key: "teslim", label: "Teslim", pct: 60 }] }).row;
    expect(() => app.offers.update(off.id, { plan: noDeposit })).toThrow(/peşinat tam bir kez/);
    expect(app.offers.update(off.id, { plan: null }).row.plan).toBeNull();
    expect(() => app.settings.set("payment_template", [{ milestone: "teslim", percent: 100, days: 0 }])).toThrow(/peşinat tam bir kez/);
    expect(() => app.settings.set("payment_template", [{ milestone: "pesinat", percent: 50, days: 0 }, { milestone: "pesinat", percent: 50, days: 0 }])).toThrow(/peşinat tam bir kez/);
    app.settings.set("payment_template", [{ milestone: "pesinat", percent: 50, days: 0 }, { milestone: "teslim", percent: 50, days: 10 }]);
    expect(app.settings.all().payment_template).toHaveLength(2);
    // a template saved before the rule still loads, so the settings screen can show it and the owner can correct it
    h.sqlite.prepare("UPDATE settings SET value = ? WHERE key = 'payment_template'").run(JSON.stringify([{ milestone: "teslim", percent: 100, days: 0 }]));
    expect(app.settings.all().payment_template).toEqual([{ milestone: "teslim", percent: 100, days: 0 }]);
  });

  it("settings.setMany saves all of its values or none of them", () => {
    expect(() => app.settings.setMany({ bagkur_monthly: 123, tax_rate_percent: 150 })).toThrow(/Too big/);
    expect(app.settings.all().bagkur_monthly).toBe(0);
    expect(sql("SELECT COUNT(*) AS n FROM events WHERE type = 'settings.updated'")[0].n).toBe(0);
    app.settings.setMany({ bagkur_monthly: 123, tax_rate_percent: 20 });
    expect(app.settings.all()).toMatchObject({ bagkur_monthly: 123, tax_rate_percent: 20 });
    expect(sql("SELECT COUNT(*) AS n FROM events WHERE type = 'settings.updated'")[0].n).toBe(2);
  });

  it("restoring a project whose opportunity was won again names the project that holds the slot instead of a raw SQL error", () => {
    const src = (app.get("source", "R10") as any).row;
    const ada = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "O", person_id: ada.id, source_id: src.id, estimated_value: 1000 }).row;
    app.opportunities.move(o.id, { stage: "kazanildi" });
    const first = sql("SELECT id FROM projects WHERE opportunity_id = ?", o.id)[0].id;
    app.projects.remove(first);
    app.opportunities.move(o.id, { stage: "teklif" });
    app.opportunities.move(o.id, { stage: "kazanildi" });
    const second = sql("SELECT id FROM projects WHERE opportunity_id = ?", o.id)[0].id;
    expect(second).not.toBe(first);
    expect(() => app.restore("project", first)).toThrow(`aynı kayıt zaten var (proje #${second})`);
    try { app.restore("project", first); } catch (e) { expect(e).toBeInstanceOf(FFError); expect((e as FFError).code).toBe("rule"); }
    expect(sql("SELECT COUNT(*) AS n FROM projects WHERE opportunity_id = ?", o.id)[0].n).toBe(1);
  });
});
