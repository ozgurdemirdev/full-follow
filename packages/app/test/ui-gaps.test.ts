import { beforeEach, expect, it } from "vitest";
import { FFError, openDb, type Clock, type DbHandle } from "@fullfollow/core";
import { appFor, appWithout, suite, type TestApp } from "./helpers";

let today = "2026-10-14";
const clock: Clock = { today: () => today, now: () => `${today}T10:00:00Z` };

suite("the data the new screens read", () => {
  let h: DbHandle;
  let app: TestApp;
  const source = () => app.get("source", "R10").row.id;
  beforeEach(() => {
    today = "2026-10-14";
    h = openDb(":memory:");
    app = appFor(h, "owner", clock);
  });

  it("a company's segment and money come from its projects, payments and open opportunities, and degrade without those modules", () => {
    const abc = app.companies.create({ name: "ABC" }).row;
    const ada = app.people.create({ name: "Ada", company_id: abc.id }).row;
    const site = app.opportunities.create({ title: "Site", person_id: ada.id, source_id: source(), estimated_value: 50000 }).row;
    app.opportunities.create({ title: "Uygulama", person_id: ada.id, source_id: source(), estimated_value: 20000 });
    expect(app.companyCard(abc.id).row).toMatchObject({ segment: "lead", money: { won: 0, due: 0, open: 70000 }, open_opps: 2 });
    const offer = app.offers.create({ opportunity_id: site.id, amount: 42000 }).row;
    app.offers.update(offer.id, { accepted: true });
    app.opportunities.move(site.id, { stage: "kazanildi" });
    const [deposit] = app.payments.list({}).rows;
    app.payments.pay(deposit.id, 16800);
    // paid 16.800 of 42.000, the other 25.200 is due, the lead that is still open is worth 20.000; the won one left the open value
    const listed = app.find("company").rows.find((c) => c.id === abc.id)!;
    expect(listed).toMatchObject({ segment: "client", money: { won: 16800, due: 25200, open: 20000 } });
    expect(app.companyCard(abc.id).row.money).toEqual(listed.money);
    // a company without a project or opportunity has zeros; without the projects module there is no client and no money received
    app.companies.create({ name: "Boş" });
    expect(app.find("company", { q: "Boş" }).rows[0]).toMatchObject({ segment: "lead", money: { won: 0, due: 0, open: 0 } });
    const bare = appWithout(["projects"], h, "owner", clock);
    expect(bare.mod("companies")!.get(abc.id)).toMatchObject({ segment: "lead", money: { won: 0, due: 0, open: 20000 } });
    const noPipeline = appWithout(["pipeline", "projects"], h, "owner", clock);
    expect(noPipeline.mod("companies")!.get(abc.id)).toMatchObject({ segment: "lead", money: { won: 0, due: 0, open: 0 }, open_opps: 0 });
  });

  it("a project waits on whoever owns its first open task; a late payment or task makes it late; Claude's tasks never count", () => {
    const p = app.people.create({ name: "Ada" }).row;
    const project = app.projects.create({ name: "Site", person_id: p.id, price: 100000 }).row;
    const waiting = () => {
      const r = app.get("project", project.id).row;
      return [r.waiting, r.waiting_amount];
    };
    expect(waiting()).toEqual([null, 0]);
    const ask = (assignee: string, due_date: string) => app.tasks.create({ title: `${assignee} işi`, assignee, due_date, project_id: project.id }).row;
    ask("claude", "2026-10-15");
    expect(waiting()).toEqual([null, 0]);
    const client = ask("musteri", "2026-10-20");
    expect(waiting()).toEqual(["musteride", 40000]);
    const mine = ask("owner", "2026-10-18");
    expect(waiting()).toEqual(["sende", 40000]);
    app.tasks.update(mine.id, { done: true });
    expect(waiting()).toEqual(["musteride", 40000]);
    // an open task past its date makes the project late, and the deposit (due 14 Oct) is overdue by now: the late money is that deposit
    today = "2026-10-21";
    expect(waiting()).toEqual(["gecikti", 40000]);
    app.tasks.update(client.id, { done: true });
    expect(waiting()).toEqual(["gecikti", 40000]);
    // paying the deposit clears the lateness (the done tasks no longer count)
    const deposit = app.payments.list({ filter: { project_id: project.id } }).rows[0];
    app.payments.pay(deposit.id, 40000);
    expect(waiting()).toEqual([null, 0]);
    expect(() => app.tasks.create({ title: "x", assignee: "baskasi" })).toThrow(FFError);
    expect(app.find("project").rows[0]).toMatchObject({ waiting: null, waiting_amount: 0 });
  });

  it("a loose touch gets the company its address domain belongs to; it moves there by hand or all at once, with an event and the status", () => {
    const co = app.companies.create({ name: "Kuzey Fırın", website: "https://www.kuzeyfirin.example" }).row;
    const ada = app.people.create({ name: "Ada", handle: "@ada_design" }).row;
    const mail = (contact: string) => app.touches.create({ contact, channel: "email", direction: "giden", summary: `mail ${contact}` }).row;
    const [info, sales, other, dm] = [mail("info@kuzeyfirin.example"), mail("Sales@KuzeyFirin.example"), mail("x@unknown.example"), app.touches.create({ contact: "@ada_design", channel: "instagram", direction: "giden", summary: "dm" }).row];
    const loose = app.find("touch", { filter: { loose: true } }).rows;
    expect(loose).toHaveLength(4);
    const match = (id: number) => loose.find((t) => t.id === id)!.suggested_match;
    expect(match(info.id)).toEqual({ type: "company", id: co.id, name: "Kuzey Fırın" });
    expect(match(sales.id)).toEqual({ type: "company", id: co.id, name: "Kuzey Fırın" });
    expect(match(other.id)).toBeNull();
    expect(match(dm.id)).toEqual({ type: "person", id: ada.id, name: "Ada" });
    // by hand: the company is set, its contact status moves like a new touch's, an event is written, a touch that has an owner cannot move again
    expect(app.touches.update(info.id, { company_id: co.id }).effects).toEqual([expect.stringContaining("Kuzey Fırın")]);
    expect(app.get("touch", info.id).row).toMatchObject({ company_id: co.id, suggested_match: null });
    expect(app.mod("companies")!.get(co.id)!.contact_status).toBe("yazildi");
    expect(h.sqlite.prepare("SELECT summary FROM events WHERE type = 'touch.adopted'").all()).toHaveLength(1);
    expect(() => app.touches.update(info.id, { person_id: ada.id })).toThrow(/zaten/);
    expect(() => app.touches.update(sales.id, { person_id: ada.id, company_id: co.id })).toThrow(FFError);
    // all at once: the suggestions only, one address at a time or every address
    expect(app.touches.adoptSuggested({ contact: "x@unknown.example" }).adopted).toBe(0);
    const all = app.touches.adoptSuggested();
    expect(all.adopted).toBe(2);
    expect(all.effects[0]).toBe("2 temas bağlandı");
    expect(app.find("touch", { filter: { loose: true } }).rows.map((t) => t.id)).toEqual([other.id]);
    expect(app.get("touch", dm.id).row).toMatchObject({ person_id: ada.id, person_name: "Ada" });
    expect(app.touches.adoptSuggested().adopted).toBe(0);
  });

  it("without the people and companies modules a loose touch has no suggestion and cannot be moved to a record", () => {
    app.companies.create({ name: "Kuzey Fırın", website: "kuzeyfirin.example" });
    const t = app.touches.create({ contact: "info@kuzeyfirin.example", channel: "email", direction: "giden", summary: "mail" }).row;
    const bare = appWithout(["companies", "people"], h, "owner", clock);
    expect(bare.mod("network")!.touches.get(t.id)!.suggested_match).toBeNull();
    expect(bare.mod("network")!.touches.adoptSuggested().adopted).toBe(0);
  });
});
