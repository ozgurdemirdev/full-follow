import { describe, expect, it } from "vitest";
import { defineModule, FFError, openDb, type Clock, type OpportunityWon, type TouchCreated } from "@fullfollow/core";
import { appFor, person } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

/** Collects the `opportunity.won` payloads and adds an effect of its own, like the projects module does */
const watcher = () => {
  const seen: OpportunityWon[] = [];
  const probe = defineModule({ key: "probe", label: "Probe", hooks: { "opportunity.won": (_ctx, p: OpportunityWon) => { seen.push(p); return ["probe: proje yok"]; } } });
  return { seen, probe };
};

describe("pipeline as a module", () => {
  it("opportunities go through the generic save, find, get, move and delete, by their Turkish aliases; the source is given by name", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "claude", clock);
    const ada = person(h);
    const o = app.save("fırsat", { title: "Site", person_id: ada, source: "R10", estimated_value: 5000 }).row;
    expect(app.get("opp", o.id).row).toMatchObject({ title: "Site", person_name: "Ada", source_name: "R10", project_id: null, created_by: "claude" });
    expect(app.get("opportunity", "Site").id).toBe(o.id);
    expect(app.move("opportunity", o.id, "teklif").effects).toEqual([]);
    expect(() => app.move("opportunity", o.id, "kaybedildi")).toThrow(/neden/);
    expect(app.move("opp", o.id, "kaybedildi", "bütçe yok").row).toMatchObject({ stage: "kaybedildi", lost_reason: "bütçe yok" });
    expect(() => app.save("opportunity", { stage: "teklif" }, o.id)).toThrow(/move/);
    expect(app.find("opportunity", { filter: { stage: "kaybedildi" } }).total).toBe(1);
    expect(app.find("source").rows.find((s) => s.name === "R10")).toMatchObject({ opp_count: 1 });
    expect(app.remove("opportunity", o.id).trash).toEqual({ type: "opportunity", id: o.id });
    expect(app.find("trash").rows[0]).toMatchObject({ type: "opportunity", what: "fırsat" });
    app.restore("opportunity", "Site");
    expect(app.get("opportunity", o.id).row.title).toBe("Site");
    // the record types of the module carry through the registry: labels, comment targets, chat chips
    app.save("comment", { target_type: "opportunity", target_id: o.id, body: "selam" });
    expect(app.find("comment").rows[0]).toMatchObject({ target_type: "opportunity", target_label: "Site" });
    expect(app.commentTargets()).toContain("opportunity");
    expect(app.ctx.types.chatCard("opportunity")!(app.ctx, o.id)).toMatchObject({ title: "Site", stage: "kaybedildi", value: 5000, person: "Ada" });
    expect(app.moduleMeta()).toMatchObject({ opp_stages: expect.arrayContaining(["teklif"]), open_opp_stages: ["bulundu", "temas", "cevap", "gorusme", "teklif"] });
  });

  it("winning emits opportunity.won with plain data inside the move, adds the customer tag, and works without any project module", () => {
    const h = openDb(":memory:");
    const { seen, probe } = watcher();
    const app = appFor(h, "ozgur", clock, [probe]);
    const ada = person(h);
    const o = app.pipeline.opportunities.create({ title: "Site", person_id: ada, source_id: app.get("source", "R10").row.id, estimated_value: 50000 }).row;
    const offer = app.pipeline.offers.create({ opportunity_id: o.id, amount: 42000, items: [{ label: "paket", amount: 42000 }] }).row;
    app.pipeline.offers.update(offer.id, { accepted: true });
    expect(app.get("opportunity", o.id).row.estimated_value).toBe(42000);
    const r = app.pipeline.opportunities.move(o.id, { stage: "kazanildi" });
    expect(r.effects).toEqual(["probe: proje yok", "müşteri etiketi eklendi"]);
    expect(seen).toEqual([{
      opportunity: { id: o.id, title: "Site", person_id: ada, company_id: null, estimated_value: 42000 },
      offer: { id: offer.id, amount: 42000, items: [{ label: "paket", amount: 42000, qty: 1, line: 42000 }], plan: null },
      price: 42000,
    }]);
    expect(h.sqlite.prepare("SELECT COUNT(*) n FROM projects").get()).toEqual({ n: 0 });
    // moving it again within the won stage emits nothing; leaving and coming back does
    expect(app.pipeline.opportunities.move(o.id, { stage: "kazanildi" }).effects).toEqual([]);
    app.pipeline.opportunities.move(o.id, { stage: "teklif" });
    expect(app.pipeline.opportunities.move(o.id, { stage: "kazanildi" }).effects).toEqual(["probe: proje yok"]);
    expect(seen).toHaveLength(2);
  });

  it("a hook that fails on opportunity.won rolls the whole move back", () => {
    const h = openDb(":memory:");
    const boom = defineModule({ key: "boom", label: "Boom", hooks: { "opportunity.won": () => { throw new FFError("rule", "no project today"); } } });
    const app = appFor(h, "ozgur", clock, [boom]);
    const o = app.pipeline.opportunities.create({ title: "Site", person_id: person(h), source_id: app.get("source", "R10").row.id }).row;
    expect(() => app.pipeline.opportunities.move(o.id, { stage: "kazanildi" })).toThrow("no project today");
    expect(app.get("opportunity", o.id).row.stage).toBe("bulundu");
    expect(h.sqlite.prepare("SELECT COUNT(*) n FROM events WHERE type = 'opp.stage'").get()).toEqual({ n: 0 });
  });

  it("offers: versions, one accepted offer, the accepted amount is the estimate, and a removed accepted offer is no longer accepted", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const o = app.pipeline.opportunities.create({ title: "Site", person_id: person(h), source_id: app.get("source", "R10").row.id, estimated_value: 1000 }).row;
    const v1 = app.pipeline.offers.create({ opportunity_id: o.id, amount: 5000 }).row;
    const v2 = app.save("teklif", { opportunity: "Site", amount: 6000, items: [{ label: "a", amount: 6000 }] }).row;
    expect([v1.version, v2.version]).toEqual([1, 2]);
    expect(app.pipeline.offers.update(v1.id, { accepted: true }).effects).toEqual(["fırsat değeri teklif tutarına çekildi"]);
    app.pipeline.offers.update(v2.id, { accepted: true });
    expect(app.pipeline.offers.of(o.id).map((x) => [x.version, !!x.accepted_at])).toEqual([[2, true], [1, false]]);
    expect(app.pipeline.offers.update(v2.id, { amount: 7000 }).effects).toEqual(["fırsat değeri güncellendi"]);
    expect(app.get("opportunity", o.id).row.estimated_value).toBe(7000);
    expect(app.find("offer", { filter: { opportunity_id: o.id } }).rows.map((x) => x.id)).toEqual([v2.id, v1.id]);
    expect(app.get("opportunity", o.id, ["offers"]).related.offers).toHaveLength(2);
    app.remove("offer", v2.id);
    app.restore("offer", v2.id);
    expect(app.pipeline.offers.of(o.id).find((x) => x.id === v2.id)!.accepted_at).toBeNull();
    expect(() => app.pipeline.offers.create({ opportunity_id: o.id, amount: 0 })).toThrow(FFError);
  });

  it("the team: members are added through the opportunity or the team API, the main contact is refused, a removed member goes to the trash", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const [ada, bob] = [person(h, "Ada"), person(h, "Bob")];
    const o = app.pipeline.opportunities.create({ title: "Site", person_id: ada, source_id: app.get("source", "R10").row.id }).row;
    expect(() => app.pipeline.team.add(o.id, { person_id: ada })).toThrow(/ana muhatap/);
    // team changes through `add_people` look the person up by name or id, which needs the people module; the team API takes the id
    expect(() => app.pipeline.opportunities.update(o.id, { add_people: [{ person: bob }] })).toThrow(/"people" modülü kurulu değil/);
    expect(app.pipeline.team.add(o.id, { person_id: bob, role: "teknik" }).effects).toEqual(["Bob ekibe eklendi"]);
    expect(app.get("opportunity", o.id, ["people"]).related.people).toMatchObject([{ person_name: "Bob", role: "teknik" }]);
    const member = app.pipeline.team.of(o.id)[0];
    app.pipeline.team.remove(member.id);
    expect(app.find("trash").rows[0]).toMatchObject({ type: "opportunity_person", what: "ekip üyesi" });
    app.restore("opportunity_person", member.id);
    expect(app.pipeline.team.of(o.id)).toHaveLength(1);
    // a person that goes to the trash takes its team rows along (the people module would delete it; the event is what the pipeline hears)
    h.sqlite.transaction(() => {
      const bin = new (class { rows: string[] = []; take(t: string) { this.rows.push(t); return []; } unlink() {} })();
      app.ctx.emit("record.trashed", { type: "person", id: bob, bin: bin as any });
      expect(bin.rows).toEqual(["opportunity_people"]);
    })();
  });

  it("a touch about an opportunity moves its stage the way the touch rules say", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const ada = person(h);
    const o = app.pipeline.opportunities.create({ title: "Site", person_id: ada, source_id: app.get("source", "R10").row.id }).row;
    const touch = (direction: string, kind: string) => h.sqlite.transaction(() => app.ctx.emit("touch.created", {
      touch: { opportunity_id: o.id, happened_at: "2026-10-14T10:00:00Z" }, subject: {}, input: { channel: "email", direction, kind }, cold: false,
    } as unknown as TouchCreated))();
    expect(touch("giden", "mesaj")).toEqual([`fırsat #${o.id} → temas`]);
    expect(touch("gelen", "mesaj")).toEqual([`fırsat #${o.id} → cevap`]);
    expect(touch("gelen", "mesaj")).toEqual([]);
    expect(touch("giden", "gorusme")).toEqual([`fırsat #${o.id} → gorusme`]);
    app.pipeline.opportunities.move(o.id, { stage: "teklif" });
    expect(touch("giden", "gorusme")).toEqual([]);
    expect(app.get("opportunity", o.id).row.stage).toBe("teklif");
    expect(h.sqlite.prepare("SELECT summary FROM events WHERE type = 'opp.stage' ORDER BY id").all()).toMatchObject([
      { summary: "Fırsat bulundu → temas (temastan)" }, { summary: "Fırsat temas → cevap (temastan)" }, { summary: "Fırsat cevap → görüşme (temastan)" }, { summary: "Fırsat görüşme → teklif" },
    ]);
  });

  it("stage_since is set on create and on every stage change only; the stage rates count what left a stage in the last 90 days and moved forward", () => {
    let now = "2026-10-14T10:00:00Z";
    const moving: Clock = { today: () => now.slice(0, 10), now: () => now };
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", moving);
    const ada = person(h);
    const r10 = app.get("source", "R10").row.id;
    const open = (title: string) => app.pipeline.opportunities.create({ title, person_id: ada, source_id: r10 }).row;
    const [a, b, c, d] = ["A", "B", "C", "D"].map(open);
    expect(app.get("opportunity", a.id).row.stage_since).toBe("2026-10-14T10:00:00Z");
    now = "2026-10-20T09:00:00Z";
    app.pipeline.opportunities.move(a.id, { stage: "temas" });
    expect(app.get("opportunity", a.id).row.stage_since).toBe("2026-10-20T09:00:00Z");
    now = "2026-10-25T09:00:00Z";
    app.pipeline.opportunities.move(a.id, { stage: "temas", position: 0 });
    app.pipeline.opportunities.update(a.id, { title: "A2" });
    expect(app.get("opportunity", a.id).row.stage_since).toBe("2026-10-20T09:00:00Z");
    // B and C move forward, D is lost, A goes on to the offer and one card steps back
    app.pipeline.opportunities.move(b.id, { stage: "temas" });
    app.pipeline.opportunities.move(c.id, { stage: "cevap" });
    app.pipeline.opportunities.move(d.id, { stage: "kaybedildi", reason: "bütçe" });
    app.pipeline.opportunities.move(a.id, { stage: "teklif" });
    app.pipeline.opportunities.move(b.id, { stage: "bulundu" });
    const rates = Object.fromEntries(app.pipeline.meta().stage_rates.map((r) => [r.stage, r.to_next]));
    // left bulundu: a, b, c forward and d lost (the move back to bulundu is a later entry); left temas: a forward, b back; others none
    expect(rates).toEqual({ bulundu: 0.75, temas: 0.5, cevap: null, gorusme: null, teklif: null });
    expect(app.pipeline.meta().stages.find((s) => s.stage === "cevap")).toEqual({ stage: "cevap", probability: 0.25, stale_days: 5 });
    // events older than 90 days no longer count
    now = "2027-02-01T09:00:00Z";
    expect(app.pipeline.meta().stage_rates.every((r) => r.to_next === null)).toBe(true);
  });

  it("the funnel, the conversion per source and the numbers other modules read", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "ozgur", clock);
    const [ada, bob] = [person(h, "Ada"), person(h, "Bob")];
    const r10 = app.get("source", "R10").row.id;
    h.sqlite.prepare("UPDATE people SET source_id = ? WHERE id IN (?, ?)").run(r10, ada, bob);
    const a = app.pipeline.opportunities.create({ title: "A", person_id: ada, source_id: r10, estimated_value: 100 }).row;
    const b = app.pipeline.opportunities.create({ title: "B", person_id: bob, source_id: r10, estimated_value: 200, stage: "teklif" }).row;
    app.pipeline.opportunities.move(a.id, { stage: "kazanildi" });
    expect(app.pipeline.bySource().find((s) => s.source === "R10")).toMatchObject({ total: 2, won: 1, lost: 0, open: 1, won_value: 100, conversion: 1 });
    const funnel = app.pipeline.funnel(30).sources.find((s) => s.source === "R10")!;
    // a later step implies the earlier ones: both people got to the offer, one won
    expect(funnel.steps.map((x) => x.count)).toEqual([2, 2, 2, 2, 2, 1]);
    expect(() => app.pipeline.funnel("bad")).toThrow(/dönem/);
    expect(app.pipeline.personStats().get(ada)).toEqual({ opps: 1, won: 1, won_value: 100, open_value: 0 });
    expect(app.pipeline.personStats().get(bob)).toEqual({ opps: 1, won: 0, won_value: 0, open_value: 200 });
    expect(app.pipeline.countsBySource().get(r10)).toBe(2);
    expect(app.pipeline.openOfferTimes()).toEqual(["2026-10-14T10:00:00Z"]);
    expect(app.pipeline.offersMade("2026-10-14", "2026-10-14")).toBe(0);
    app.pipeline.opportunities.move(b.id, { stage: "gorusme" });
    app.pipeline.opportunities.move(b.id, { stage: "teklif" });
    expect(app.pipeline.offersMade("2026-10-14", "2026-10-14")).toBe(1);
    expect(app.pipeline.opportunities.titles([a.id, b.id, 999])).toEqual(new Map([[a.id, "A"], [b.id, "B"]]));
    expect(app.pipeline.opportunities.openIdsOf(bob)).toEqual([b.id]);
    expect(app.pipeline.opportunities.countOf(ada)).toBe(1);
  });
});
