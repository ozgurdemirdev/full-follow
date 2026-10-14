import { describe, expect, it } from "vitest";
import { defineModule, FFError, openDb, type Clock, type OpportunityWon, type RecordTrashed } from "@fullfollow/core";
import { appFor, person } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

/** An opportunity row for the foreign key (the pipeline module is not installed here) */
function opportunityRow(h: ReturnType<typeof openDb>, personId: number, title = "Site"): number {
  const sourceId = (h.sqlite.prepare("SELECT id FROM sources LIMIT 1").get() as { id: number }).id;
  return Number(h.sqlite.prepare("INSERT INTO opportunities (title, person_id, source_id, stage, created_at, updated_at, created_by) VALUES (?, ?, ?, 'kazanildi', ?, ?, 'ozgur')")
    .run(title, personId, sourceId, clock.now(), clock.now()).lastInsertRowid);
}

describe("projects as a module", () => {
  it("projects and payments go through the generic save, find, get, move and delete, by their Turkish aliases; the plan follows the template", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "claude", clock);
    const ada = person(h);
    const p = app.save("proje", { name: "Site", person_id: ada, price: 100000 });
    expect(p.effects).toEqual(["3 ödeme planlandı"]);
    expect(app.get("project", "Site").row).toMatchObject({ id: p.row.id, person_name: "Ada", paid_total: 0, expected_total: 100000, next_task: null, created_by: "claude" });
    const pays = app.find("payment").rows;
    expect(pays.map((x) => [x.milestone, x.expected_amount, x.due_date, x.status])).toEqual([["pesinat", 40000, "2026-10-14", "bekliyor"], ["tasarim_onayi", 30000, "2026-10-28", "bekliyor"], ["yayin", 30000, "2026-11-13", "bekliyor"]]);
    expect(app.get("project", p.row.id, ["payments"]).related.payments).toHaveLength(3);
    expect(app.get("project", p.row.id).row.next_payment).toMatchObject({ milestone: "pesinat", remaining: 40000 });
    expect(app.get("ödeme", pays[0].id).row).toMatchObject({ project_name: "Site", status: "bekliyor" });
    expect(() => app.save("project", { stage: "yayin" }, p.row.id)).toThrow(/move/);
    // the price changing on a project that has payments leaves the plan alone
    expect(app.save("project", { price: 120000 }, p.row.id).effects).toEqual(["fiyat değişti, mevcut ödeme planı güncellenmedi"]);
    expect(app.moduleMeta()).toMatchObject({ project_stages: expect.arrayContaining(["pesinat", "iptal"]), milestones: expect.arrayContaining(["pesinat", "yayin"]) });
  });

  it("the deposit rule, partial payments, corrections and the money the reports read", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const p = app.projects.projects.create({ name: "Site", person_id: person(h), price: 100000 }).row;
    const [dep, design] = app.projects.payments.list({ filter: { project_id: p.id } }).rows;
    expect(() => app.move("project", p.id, "tasarim_onayi")).toThrow(/Peşinat tam ödenmeden/);
    expect(app.projects.payments.pay(dep.id, 39999, "2026-10-10").effects).toEqual([]);
    expect(() => app.move("project", p.id, "tasarim_onayi")).toThrow(/39.999₺\/40.000₺/);
    expect(app.projects.payments.pay(dep.id, 1, "2026-10-11").effects).toEqual(["tamamen ödendi", "peşinat tamam, proje ilerleyebilir"]);
    expect(app.move("project", p.id, "tasarim_onayi").row.stage).toBe("tasarim_onayi");
    expect(app.move("project", p.id, "teslim").effects).toEqual(["teslim tarihi bugün olarak yazıldı"]);
    expect(() => app.projects.payments.pay(dep.id, 1)).toThrow(/Kalan tutar/);
    app.projects.payments.pay(design.id, 5000, "2026-11-02");
    expect(app.projects.collectedIn("2026-10")).toBe(40000);
    expect(app.projects.collectedIn("2026-11")).toBe(5000);
    expect(app.projects.outstandingDue("2026-10")).toBe(25000);
    // a correction moves the ledger with it
    app.projects.payments.update(design.id, { paid_amount: 8000, paid_at: "2026-10-20" });
    expect(app.projects.collectedIn("2026-11")).toBe(0);
    expect(app.projects.collectedIn("2026-10")).toBe(48000);
    expect(app.projects.payments.list({ filter: { status: "kismi" } }).rows.map((x) => x.id)).toEqual([design.id]);
    expect(app.projects.payments.due("2026-10-01", "2026-10-31").map((x) => [x.milestone, x.done])).toEqual([["pesinat", true], ["tasarim_onayi", false]]);
    expect(app.projects.personStats().get(p.person_id)).toEqual({ projects: 1, collected: 48000 });
    // a project with money received cannot be deleted; a payment with money cannot either
    expect(() => app.remove("project", p.id)).toThrow(/ödeme alınmış/);
    expect(() => app.remove("payment", dep.id)).toThrow(/Ödeme alınmış/);
  });

  it("the Today view and the comment targets carry the module's payments and records", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const p = app.projects.projects.create({ name: "Site", person_id: person(h), price: 10000 }).row;
    expect(app.today().payments.total).toBe(1);
    const pay = app.projects.payments.list({}).rows[0];
    app.save("comment", { target_type: "payment", target_id: pay.id, body: "x" });
    app.save("comment", { target_type: "project", target_id: p.id, body: "y" });
    expect(app.find("comment").rows.map((t) => t.target_label).sort()).toEqual(["Site", `ödeme #${pay.id} (pesinat)`]);
    expect(app.ctx.types.chatCard("payment")!(app.ctx, pay.id)).toMatchObject({ title: "Site", milestone: "pesinat", expected: 4000, paid: 0 });
    expect(app.projects.projects.names([p.id, 999])).toEqual(new Map([[p.id, "Site"]]));
    expect(app.projects.projects.ref(p.id)).toEqual({ id: p.id, name: "Site", person_id: p.person_id, opportunity_id: null });
  });

  it("a won opportunity opens its project and plan from the event payload, once", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const ada = person(h);
    const oppId = opportunityRow(h, ada);
    const won = (price: number): OpportunityWon => ({
      opportunity: { id: oppId, title: "Site", person_id: ada, company_id: null, estimated_value: price }, offer: price ? { id: 1, amount: price, items: [] } : null, price,
    });
    const emitWon = (price: number) => h.sqlite.transaction(() => app.ctx.emit("opportunity.won", won(price)))();
    expect(emitWon(80000)).toEqual([expect.stringMatching(/^proje #\d+ açıldı$/), "3 ödeme planlandı"]);
    expect(app.projects.projects.list({}).rows).toMatchObject([{ name: "Site", opportunity_id: oppId, price: 80000, stage: "pesinat", started_at: "2026-10-14" }]);
    expect(app.projects.payments.list({}).rows.map((x) => x.expected_amount)).toEqual([32000, 24000, 24000]);
    expect(app.projects.projects.forOpportunity(oppId)).toBeTypeOf("number");
    expect(app.projects.projects.idsForOpportunities([oppId, 999]).size).toBe(1);
    expect(emitWon(80000)).toEqual(["proje zaten var"]);
    expect(app.projects.projects.list({}).total).toBe(1);
    // no price, no plan
    const free = opportunityRow(h, ada, "Bedava");
    expect(h.sqlite.transaction(() => app.ctx.emit("opportunity.won", { ...won(0), opportunity: { ...won(0).opportunity, id: free, title: "Bedava" } }))()).toEqual([expect.stringMatching(/açıldı$/), "fiyat girilmediği için ödeme planı yok"]);
    const events = h.sqlite.prepare("SELECT type, summary FROM events WHERE type IN ('project.created', 'payment.planned') ORDER BY id").all();
    expect(events).toEqual([
      { type: "project.created", summary: "Proje açıldı: Site" }, { type: "payment.planned", summary: "Ödeme planı oluşturuldu: 3 taksit, toplam 80.000₺" }, { type: "project.created", summary: "Proje açıldı: Bedava" },
    ]);
  });

  it("an opportunity given without the pipeline module is refused; deleting a project tells the other modules and rolls back when a hook fails", () => {
    const h = openDb(":memory:");
    const seen: RecordTrashed[] = [];
    const probe = defineModule({ key: "probe", label: "Probe", hooks: { "record.trashed": (_ctx, p: RecordTrashed) => { seen.push({ type: p.type, id: p.id, bin: p.bin }); } } });
    const app = appFor(h, "ozgur", clock, [probe]);
    const ada = person(h);
    expect(() => app.projects.projects.create({ name: "Site", person_id: ada, opportunity_id: 1 })).toThrow(/"pipeline" modülü kurulu değil/);
    const p = app.projects.projects.create({ name: "Site", person_id: ada, price: 1000 }).row;
    app.remove("project", p.id);
    expect(seen.map((s) => [s.type, s.id])).toEqual([["project", p.id]]);
    expect(app.find("trash").rows[0]).toMatchObject({ type: "project", what: "proje" });
    expect(h.sqlite.prepare("SELECT COUNT(*) n FROM payments").get()).toEqual({ n: 0 });
    app.restore("project", "Site");
    expect(h.sqlite.prepare("SELECT COUNT(*) n FROM payments").get()).toEqual({ n: 3 });
    const boom = defineModule({ key: "boom", label: "Boom", hooks: { "record.trashed": () => { throw new FFError("rule", "cleanup failed"); } } });
    const app2 = appFor(h, "ozgur", clock, [boom]);
    expect(() => app2.remove("project", p.id)).toThrow("cleanup failed");
    expect(app2.projects.projects.get(p.id)).toBeTruthy();
  });
});
