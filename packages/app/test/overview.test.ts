import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Clock, type DbHandle } from "@fullfollow/core";
import { appFor, suite, type TestApp } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

suite("the people and companies screens page through overview, not through a capped list", () => {
  let h: DbHandle;
  let app: TestApp;
  const people = () => app.mod("people")!;
  const companies = () => app.mod("companies")!;
  const sql = (q: string, ...a: unknown[]) => h.sqlite.prepare(q).run(...a);
  beforeEach(() => {
    h = openDb(":memory:");
    app = appFor(h, "ozgur", clock);
  });

  /** Ada: a follow-up came due. Dina: a reply is awaited. Bob: new. Cem: nothing special (his record is old). */
  function book() {
    const ada = app.people.create({ name: "Ada", linkedin: "linkedin.com/in/ada", next_follow_up_at: "2026-10-10" }).row;
    const dina = app.people.create({ name: "Dina", email: "dina@x.example" }).row;
    const bob = app.people.create({ name: "Bob", email: "bob@x.example" }).row;
    const cem = app.people.create({ name: "Cem", phone: "0532 000 00 00" }).row;
    sql("UPDATE people SET created_at = '2026-01-01T10:00:00Z' WHERE id IN (?, ?, ?)", ada.id, dina.id, cem.id);
    app.touches.create({ person_id: dina.id, channel: "email", direction: "giden", summary: "selam", expects_reply: true, happened_at: "2026-10-01T09:00:00Z" });
    return { ada, dina, bob, cem };
  }

  it("people overview: rows by state, counts per state before the state filter, the page and the total", () => {
    const { ada, dina, bob, cem } = book();
    const all = people().overview({ limit: 50 });
    expect(all.rows.map((p) => p.id)).toEqual([ada.id, dina.id, bob.id, cem.id]);
    expect(all.counts).toEqual({ all: 4, due: 1, wait: 1, cold: 0, fresh: 1 });
    expect(all.total).toBe(4);

    const wait = people().overview({ filter: { state: "wait" }, limit: 50 });
    expect(wait.rows.map((p) => p.id)).toEqual([dina.id]);
    // the counts ignore the state filter, the total does not
    expect(wait.counts.all).toBe(4);
    expect(wait.total).toBe(1);

    const second = people().overview({ limit: 2, offset: 2 });
    expect(second.rows.map((p) => p.id)).toEqual([bob.id, cem.id]);
    expect(second.total).toBe(4);
  });

  it("people overview: the channel filter is an account on that channel, ids and the search narrow before the counts", () => {
    const { ada, dina, bob } = book();
    expect(people().overview({ filter: { has_channel: "linkedin" }, limit: 50 }).rows.map((p) => p.id)).toEqual([ada.id]);
    expect(people().overview({ filter: { has_channel: "email" }, limit: 50 }).rows.map((p) => p.id)).toEqual([dina.id, bob.id]);
    const picked = people().overview({ filter: { ids: `${bob.id},${ada.id}` }, limit: 50 });
    expect(picked.rows.map((p) => p.id)).toEqual([ada.id, bob.id]);
    expect(picked.counts.all).toBe(2);
    const found = people().overview({ q: "dina", limit: 50 });
    expect(found.counts).toMatchObject({ all: 1, wait: 1, due: 0 });
  });

  it("the touch queue takes due, awaited and cooling people first, the most overdue inside a state, and leaves excluded ones out", () => {
    const { ada, dina, bob } = book();
    expect(people().touchQueue({}).map((p) => p.id)).toEqual([ada.id, dina.id]);
    expect(people().touchQueue({ exclude: [ada.id] }).map((p) => p.id)).toEqual([dina.id]);
    expect(people().touchQueue({ all: true, limit: 3 }).map((p) => p.id)).toEqual([ada.id, dina.id, bob.id]);
    expect(people().summary()).toEqual({ people: 4, cooling: 0 });
  });

  it("companies overview: segment counts, sort by value, a first project, the people of a tile, Claude's hint, and the totals of the whole book", () => {
    const a = app.companies.create({ name: "Acme" }).row;
    const b = app.companies.create({ name: "Beta" }).row;
    const ada = app.people.create({ name: "Ada", company_id: a.id }).row;
    const bob = app.people.create({ name: "Bob", company_id: b.id, influence: "karar_verici" }).row;
    const project = app.projects.create({ name: "Site", person_id: ada.id, price: 9000, started_at: "2026-03-05" }).row;
    app.payments.pay(app.payments.list({ filter: { project_id: project.id }, limit: 10 }).rows[0].id, 1000);
    app.opportunities.create({ title: "App", person_id: bob.id, source_id: app.get("source", "R10").row.id, estimated_value: 5000 });
    appFor(h, "claude", clock).save("comment", { target_type: "company", target_id: b.id, body: "Bunu ara" });

    const o = companies().overview({ limit: 50 });
    expect(o.rows.map((c) => c.name)).toEqual(["Acme", "Beta"]);
    expect(o.counts).toEqual({ all: 2, client: 1, lead: 1, partner: 0 });
    expect(o.rows[0]).toMatchObject({ first_project_at: "2026-03-05", people: [{ id: ada.id, name: "Ada" }], hint: null });
    expect(o.rows[1]).toMatchObject({ hint: "Bunu ara", people: [{ id: bob.id }], first_project_at: null });

    const leads = companies().overview({ filter: { segment: "lead", sort: "name" }, limit: 50 });
    expect(leads.rows.map((c) => c.name)).toEqual(["Beta"]);
    expect(leads.counts.all).toBe(2);
    expect(companies().overview({ filter: { ids: String(b.id) }, limit: 50 }).total).toBe(1);

    const totals = companies().totals();
    expect(totals).toMatchObject({ won: 1000, due: 8000, dueCompanies: 1, open: 5000, openCompanies: 1, deciders: 1, unreached_count: 1, unreached: ["Beta"], top_worth: 9000 });
  });

  it("projects can be listed for several people at once", () => {
    const a = app.people.create({ name: "Ada" }).row;
    const b = app.people.create({ name: "Bob" }).row;
    const c = app.people.create({ name: "Cem" }).row;
    for (const [name, p] of [["A", a], ["B", b], ["C", c]] as const) app.projects.create({ name, person_id: p.id, price: 1000 });
    expect(app.projects.list({ filter: { person_ids: `${a.id},${c.id}` }, limit: 10 }).rows.map((p) => p.name).sort()).toEqual(["A", "C"]);
  });
});
