import { beforeEach, describe, expect, it } from "vitest";
import { openDb, type Clock, type DbHandle } from "@fullfollow/core";
import { appFor, suite, type TestApp } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

/** Drafts, templates, ideas and own projects with the people, network and pipeline modules: the rules that cross them */
suite("drafts, ideas and the modules around them", () => {
  let h: DbHandle;
  let app: TestApp;
  const sql = <T = any>(q: string, ...a: unknown[]) => h.sqlite.prepare(q).all(...a) as T[];
  const count = (table: string) => sql(`SELECT COUNT(*) n FROM ${table}`)[0].n;
  beforeEach(() => {
    h = openDb(":memory:");
    app = appFor(h, "owner", clock);
  });

  it("a touch tells the modules in key order: the send warnings (drafts), the idea link (ideas), then the opportunity stage (pipeline)", () => {
    const ada = app.people.create({ name: "Ada", email: "ada@x.example" }).row;
    const opp = app.opportunities.create({ title: "Site", person_id: ada.id, source_id: app.get("source", "R10").row.id }).row;
    const idea = app.ideas.create({ title: "Klinik botu" }).row;
    app.settings.setMany({ channel_limits: { email: 1 }, email_warmup_until: "2026-10-20" });
    const r = app.touches.create({ person_id: ada.id, channel: "email", direction: "giden", summary: "merhaba", opportunity_id: opp.id, idea_id: idea.id });
    const at = (prefix: string) => r.effects.findIndex((e) => e.startsWith(prefix));
    expect(r.effects).toEqual([
      "Ada: yazıldı",
      "Uyarı: e-posta günlük limiti doldu (1/1)",
      "Uyarı: soğuk e-posta ısınma döneminde kapalı (20.10 tarihine kadar)",
      "Ada fikre bağlandı",
      `fırsat #${opp.id} → temas`,
    ]);
    expect(at("Uyarı")).toBeLessThan(at("Ada fikre"));
    expect(at("Ada fikre")).toBeLessThan(at("fırsat"));
    expect(sql("SELECT interest, touch_id FROM idea_people")).toEqual([{ interest: "anlatildi", touch_id: r.row.id }]);
  });

  it("deleting a person takes its drafts (with the touches that were written for them), idea links and comments in an order that keeps the foreign keys; restoring brings it all back", () => {
    const ada = app.people.create({ name: "Ada", email: "ada@x.example" }).row;
    const idea = app.ideas.create({ title: "Klinik botu" }).row;
    const sent = app.drafts.create({ person_id: ada.id, channel: "email", body: "merhaba" }).row;
    const waiting = app.drafts.create({ person_id: ada.id, channel: "email", body: "ikinci" }).row;
    const touch = app.drafts.markSent(sent.id).touch!;
    app.ideas.saveInterest({ idea_id: idea.id, person_id: ada.id, touch_id: touch.id });
    app.save("comment", { target_type: "draft", target_id: waiting.id, body: "taslak yorumu" });
    app.save("comment", { target_type: "person", target_id: ada.id, body: "kişi yorumu" });

    app.remove("person", ada.id);
    for (const t of ["people", "drafts", "touches", "idea_people", "comments"]) expect(count(t)).toBe(0);
    expect(count("ideas")).toBe(1);
    // the touch is taken before the draft it points at, the idea link before the touch
    const parts = JSON.parse(sql("SELECT payload FROM trash")[0].payload).parts.map((p: any) => p.table);
    expect(parts.indexOf("idea_people")).toBeLessThan(parts.indexOf("touches"));
    expect(parts.indexOf("touches")).toBeLessThan(parts.indexOf("drafts"));

    app.restore("person", ada.id);
    expect(sql("SELECT id, status FROM drafts ORDER BY id")).toEqual([{ id: sent.id, status: "gonderildi" }, { id: waiting.id, status: "bekliyor" }]);
    expect(sql("SELECT draft_id FROM touches")).toEqual([{ draft_id: sent.id }]);
    expect(sql("SELECT touch_id FROM idea_people")).toEqual([{ touch_id: touch.id }]);
    expect(count("comments")).toBe(2);
  });

  it("deleting a company takes the drafts written to it and restoring brings them back; an opportunity or project only lets go of its drafts", () => {
    const co = app.companies.create({ name: "ABC", email: "info@abc.example" }).row;
    const sent = app.drafts.create({ company_id: co.id, channel: "email", body: "merhaba" }).row;
    app.drafts.markSent(sent.id);
    app.remove("company", co.id);
    expect(count("drafts")).toBe(0);
    expect(count("touches")).toBe(0);
    app.restore("company", co.id);
    expect(sql("SELECT company_id FROM drafts")).toEqual([{ company_id: co.id }]);
    expect(sql("SELECT draft_id FROM touches")).toEqual([{ draft_id: sent.id }]);

    const ada = app.people.create({ name: "Ada" }).row;
    const opp = app.opportunities.create({ title: "Site", person_id: ada.id, source_id: app.get("source", "R10").row.id }).row;
    const d = app.drafts.create({ person_id: ada.id, channel: "email", body: "x", opportunity_id: opp.id }).row;
    app.remove("opportunity", opp.id);
    expect(sql("SELECT opportunity_id FROM drafts WHERE id = ?", d.id)).toEqual([{ opportunity_id: null }]);
    app.restore("opportunity", opp.id);
    expect(sql("SELECT opportunity_id FROM drafts WHERE id = ?", d.id)).toEqual([{ opportunity_id: opp.id }]);
  });

  it("deleting an idea lets go of its touches and posts and takes its interest rows; deleting a touch frees the interest link; both come back on restore", () => {
    const ada = app.people.create({ name: "Ada" }).row;
    const idea = app.ideas.create({ title: "Klinik botu" }).row;
    const post = app.mod("posts")!.create({ platform: "linkedin", title: "Tanıtım", idea_id: idea.id }).row;
    const t = app.touches.create({ person_id: ada.id, channel: "email", direction: "giden", summary: "fikir", idea_id: idea.id }).row;
    expect(sql("SELECT touch_id FROM idea_people")).toEqual([{ touch_id: t.id }]);
    app.remove("idea", idea.id);
    expect(sql("SELECT idea_id FROM touches")).toEqual([{ idea_id: null }]);
    expect(sql("SELECT idea_id FROM posts")).toEqual([{ idea_id: null }]);
    expect(count("idea_people")).toBe(0);
    app.restore("idea", idea.id);
    expect(sql("SELECT idea_id FROM touches")).toEqual([{ idea_id: idea.id }]);
    expect(sql("SELECT idea_id FROM posts WHERE id = ?", post.id)).toEqual([{ idea_id: idea.id }]);
    expect(count("idea_people")).toBe(1);

    app.remove("touch", t.id);
    expect(sql("SELECT touch_id FROM idea_people")).toEqual([{ touch_id: null }]);
    app.restore("touch", t.id);
    expect(sql("SELECT touch_id FROM idea_people")).toEqual([{ touch_id: t.id }]);
  });

  it("the referral report and the person card read the tree, the opportunities and the money from the modules that own them", () => {
    const boss = app.people.create({ name: "Tanıtan" }).row;
    const b = app.people.create({ name: "B", referred_by_id: boss.id }).row;
    app.opportunities.create({ title: "B işi", person_id: b.id, source_id: app.get("source", "R10").row.id, estimated_value: 1000 });
    expect(app.reports.referrals()).toEqual([expect.objectContaining({ person_id: boss.id, direct: 1, network: 1, opps: 1, open_value: 1000 })]);
    expect(app.personCard(boss.id).referral_value).toMatchObject({ person_id: boss.id, opps: 1 });
    expect(app.get("person", boss.id).row.referral_value).toMatchObject({ direct: 1 });
    expect(app.personCard(b.id).referral_value).toBeNull();
  });
});
