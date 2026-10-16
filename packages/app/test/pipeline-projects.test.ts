import { beforeEach, expect, it } from "vitest";
import { FFError, openDb, type Clock, type DbHandle } from "@fullfollow/core";
import { appFor, appWithout, suite, type TestApp } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

suite("pipeline and projects together", () => {
  let h: DbHandle;
  let app: TestApp;
  const sql = <T = any>(q: string, ...a: unknown[]) => h.sqlite.prepare(q).all(...a) as T[];
  const source = () => app.get("source", "R10").row.id;
  beforeEach(() => {
    h = openDb(":memory:");
    app = appFor(h, "owner", clock);
  });

  it("a won opportunity opens its project and payment plan through the event, in the same transaction, with the same effects and events as before", () => {
    const p = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: source(), estimated_value: 50000 }).row;
    const offer = app.offers.create({ opportunity_id: o.id, amount: 42000 }).row;
    app.offers.update(offer.id, { accepted: true });
    const r = app.opportunities.move(o.id, { stage: "kazanildi" });
    const projectId = sql("SELECT id FROM projects")[0].id;
    expect(r.effects).toEqual([`proje #${projectId} açıldı`, "3 ödeme planlandı", "müşteri etiketi eklendi"]);
    // the accepted offer is the price; the opportunity row shows its project
    expect(sql("SELECT price, stage, opportunity_id, person_id FROM projects")).toEqual([{ price: 42000, stage: "pesinat", opportunity_id: o.id, person_id: p.id }]);
    expect(app.get("opportunity", o.id).row.project_id).toBe(projectId);
    expect(sql("SELECT type FROM events WHERE type IN ('opp.stage', 'project.created', 'payment.planned') ORDER BY id").map((e) => e.type)).toEqual(["opp.stage", "project.created", "payment.planned"]);
    // going back and winning again opens no second project
    app.opportunities.move(o.id, { stage: "teklif" });
    expect(app.opportunities.move(o.id, { stage: "kazanildi" }).effects).toEqual(["proje zaten var"]);
    expect(sql("SELECT COUNT(*) n FROM projects")[0].n).toBe(1);
    // an opportunity with a project cannot be deleted, and neither can the person
    expect(() => app.remove("opportunity", o.id)).toThrow(/projesi var/);
    expect(() => app.remove("person", p.id)).toThrow(/fırsatları var/);
  });

  it("winning works without the projects module: no project, the customer tag still comes", () => {
    const p = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: source(), estimated_value: 50000 }).row;
    const bare = appWithout(["projects"], h, "owner", clock);
    expect(bare.mod("pipeline")!.opportunities.move(o.id, { stage: "kazanildi" }).effects).toEqual(["müşteri etiketi eklendi"]);
    expect(sql("SELECT COUNT(*) n FROM projects")[0].n).toBe(0);
    expect(bare.get("opportunity", o.id).row).toMatchObject({ stage: "kazanildi", project_id: null });
    expect(bare.mod("reports")!.month("2026-10")).toMatchObject({ collected: 0, outstanding_due: 0 });
    expect(bare.ctx.mod("calendar")!.calendar("2026-10-01", "2026-10-31")[0].payments).toEqual([]);
    expect(() => bare.save("task", { title: "x", project_id: 1 })).toThrow(/"projects" modülü kurulu değil/);
  });

  it("without the pipeline module the other modules refuse an opportunity link clearly and read zero", () => {
    const p = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: source() }).row;
    const bare = appWithout(["pipeline"], h, "owner", clock);
    expect(() => bare.save("touch", { person_id: p.id, channel: "email", direction: "giden", summary: "x", opportunity_id: o.id })).toThrow(/"pipeline" modülü kurulu değil/);
    expect(() => bare.save("task", { title: "x", opportunity_id: o.id })).toThrow(/"pipeline" modülü kurulu değil/);
    expect(() => bare.mod("drafts")!.create({ person_id: p.id, channel: "email", body: "x", opportunity_id: o.id })).toThrow(/"pipeline" modülü kurulu değil/);
    expect(() => bare.ctx.mod("projects")!.projects.create({ name: "P", person_id: p.id, opportunity_id: o.id })).toThrow(/"pipeline" modülü kurulu değil/);
    // a touch without an opportunity is fine, and nothing advances
    expect(bare.save("touch", { person_id: p.id, channel: "email", direction: "giden", summary: "x" }).row.opportunity_id).toBeNull();
    expect(sql("SELECT stage FROM opportunities")[0].stage).toBe("bulundu");
    expect(bare.ctx.mod("people")!.card(p.id)).toMatchObject({ opportunities: [], projects: [] });
  });

  it("a project's next task comes from the calendar, and the calendar feed lists the payments due", () => {
    const p = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: source(), estimated_value: 30000 }).row;
    app.opportunities.move(o.id, { stage: "kazanildi" });
    const projectId = app.find("project").rows[0].id;
    app.tasks.create({ title: "tasarım", project_id: projectId, due_date: "2026-10-20" });
    expect(app.find("project").rows[0].next_task).toMatchObject({ title: "tasarım" });
    expect(app.get("project", projectId, ["tasks"]).related.tasks).toMatchObject([{ title: "tasarım", project_name: "Site" }]);
    const days = app.goals.calendar("2026-10-14", "2026-10-28");
    expect(days.flatMap((d) => d.payments.map((x) => [d.date, x.milestone, x.project_name]))).toEqual([["2026-10-14", "pesinat", "Site"], ["2026-10-28", "tasarim_onayi", "Site"]]);
    expect(app.today().payments).toMatchObject({ total: 1, rows: [{ milestone: "pesinat", project_name: "Site" }] });
  });

  it("deleting an opportunity or project takes its attachments and lets go of drafts, touches and tasks; restoring ties everything back", () => {
    const p = app.people.create({ name: "Ada", email: "ada@x.example" }).row;
    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: source() }).row;
    app.offers.create({ opportunity_id: o.id, amount: 500 });
    app.save("comment", { target_type: "opportunity", target_id: o.id, body: "selam" });
    app.save("link", { target_type: "opportunity", target_id: o.id, label: "x", url: "https://x.example" });
    const d = app.drafts.create({ person_id: p.id, channel: "email", body: "merhaba", opportunity_id: o.id }).row;
    const task = app.tasks.create({ title: "hazırla", opportunity_id: o.id }).row;
    app.remove("opportunity", o.id);
    expect(sql("SELECT opportunity_id FROM drafts WHERE id = ?", d.id)[0].opportunity_id).toBeNull();
    expect(sql("SELECT opportunity_id FROM tasks WHERE id = ?", task.id)[0].opportunity_id).toBeNull();
    expect(sql("SELECT COUNT(*) n FROM offers")[0].n + sql("SELECT COUNT(*) n FROM comments")[0].n + sql("SELECT COUNT(*) n FROM links")[0].n).toBe(0);
    app.restore("opportunity", o.id);
    expect(sql("SELECT opportunity_id FROM drafts WHERE id = ?", d.id)[0].opportunity_id).toBe(o.id);
    expect(sql("SELECT opportunity_id FROM tasks WHERE id = ?", task.id)[0].opportunity_id).toBe(o.id);
    expect(sql("SELECT COUNT(*) n FROM offers")[0].n + sql("SELECT COUNT(*) n FROM comments")[0].n + sql("SELECT COUNT(*) n FROM links")[0].n).toBe(3);

    const pr = app.projects.create({ name: "Elle", person_id: p.id, price: 1000 }).row;
    const d2 = app.drafts.create({ person_id: p.id, channel: "email", body: "proje", project_id: pr.id }).row;
    app.remove("project", pr.id);
    expect(sql("SELECT project_id FROM drafts WHERE id = ?", d2.id)[0].project_id).toBeNull();
    app.restore("project", pr.id);
    expect(sql("SELECT project_id FROM drafts WHERE id = ?", d2.id)[0].project_id).toBe(pr.id);
    expect(sql("SELECT COUNT(*) n FROM payments")[0].n).toBe(3);
  });

  it("an offer's file link is emptied when the file goes to the trash, and the file attaches to the opportunity", () => {
    const p = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: source() }).row;
    const f = app.files.create({ target_type: "opportunity", target_id: o.id, name: "teklif.pdf", mime: "application/pdf", size: 10, stored_name: "x.pdf" }).row;
    const offer = app.offers.create({ opportunity_id: o.id, amount: 500, file_id: f.id }).row;
    expect(app.get("opportunity", o.id, ["files"]).related.files).toHaveLength(1);
    app.files.remove(f.id);
    expect(sql("SELECT file_id FROM offers WHERE id = ?", offer.id)[0].file_id).toBeNull();
    expect(() => app.files.create({ target_type: "project", target_id: 999, name: "a", mime: "x", size: 1, stored_name: "y" })).toThrow(FFError);
    expect(() => appWithout(["pipeline"], h, "owner", clock).files.create({ target_type: "opportunity", target_id: o.id, name: "a", mime: "x", size: 1, stored_name: "y" })).toThrow(/"pipeline" modülü kurulu değil/);
  });
});
