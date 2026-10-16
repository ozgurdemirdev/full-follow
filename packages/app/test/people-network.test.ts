import { beforeEach, describe, expect, it } from "vitest";
import { FFError, openDb, type Clock, type DbHandle } from "@fullfollow/core";
import { appFor, appWithout, everyKey, suite, type TestApp } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

suite("people, companies and network together", () => {
  let h: DbHandle;
  let app: TestApp;
  const sql = <T = any>(q: string, ...a: unknown[]) => h.sqlite.prepare(q).all(...a) as T[];
  beforeEach(() => {
    h = openDb(":memory:");
    app = appFor(h, "owner", clock);
  });

  it("a person saved with a company name opens the company, reuses an existing one and refuses one in the trash", () => {
    const a = app.save("person", { name: "Ada", company: "ABC Ltd" }).row;
    expect(app.get("company", a.company_id).row.name).toBe("ABC Ltd");
    const b = app.save("person", { name: "Bob", company: "abc" }).row;
    expect(b.company_id).toBe(a.company_id);
    expect(app.find("company").total).toBe(1);
    // a company that is in the trash is a duplicate: the person is not saved
    app.remove("company", a.company_id);
    expect(() => app.save("person", { name: "Cem", company: "ABC Ltd" })).toThrow(/çöp kutusunda/);
    expect(app.find("person", { q: "Cem" }).total).toBe(0);
  });

  it("a touch moves the contact status of the person and its company forward, never back, and says what changed", () => {
    const c = app.companies.create({ name: "ABC" }).row;
    const p = app.people.create({ name: "Ada", company_id: c.id }).row;
    const out = app.touches.create({ person_id: p.id, channel: "email", direction: "giden", summary: "merhaba" });
    expect(out.effects.slice(0, 2)).toEqual(["Ada: yazıldı", "ABC: yazıldı"]);
    expect(app.touches.create({ person_id: p.id, channel: "email", direction: "giden", summary: "tekrar" }).effects.filter((e) => e.includes(":"))).toEqual([]);
    expect(app.touches.create({ person_id: p.id, channel: "telefon", direction: "gelen", kind: "arama", summary: "aradı" }).effects.slice(0, 2)).toEqual(["Ada: görüşüldü", "ABC: görüşüldü"]);
    app.people.update(p.id, { contact_status: "arkadas" });
    expect(app.touches.create({ person_id: p.id, channel: "email", direction: "gelen", summary: "selam" }).effects).not.toContain("Ada: cevap geldi");
    // a touch written to the company moves only the company
    const d = app.companies.create({ name: "Başka" }).row;
    expect(app.touches.create({ company_id: d.id, channel: "linkedin", direction: "gelen", summary: "cevap" }).effects).toEqual(["Başka: cevap geldi"]);
  });

  it("touches saved with only an address join the person or company created with that address, and move its status", () => {
    app.touches.create({ contact: "ada@x.example", channel: "email", direction: "giden", summary: "soğuk" });
    app.touches.create({ contact: "@abc", channel: "instagram", direction: "gelen", summary: "dm" });
    expect(app.find("touch", { filter: { loose: true } }).total).toBe(2);
    const p = app.people.create({ name: "Ada", email: "ADA@x.example" });
    expect(p.effects).toEqual(["1 temas bağlandı"]);
    expect(app.find("touch", { filter: { person_id: p.row.id } }).total).toBe(1);
    expect(app.get("person", p.row.id).row.contact_status).toBe("yazildi");
    const c = app.companies.create({ name: "ABC", instagram: "@abc" });
    expect(c.effects).toEqual(["1 temas bağlandı"]);
    expect(app.get("company", c.row.id).row.contact_status).toBe("cevap_geldi");
    expect(app.find("touch", { filter: { loose: true } }).total).toBe(0);
  });

  it("deleting a person takes its touches and tasks (and the comments on the tasks) into the same trash row; restoring brings them all back", () => {
    const p = app.people.create({ name: "Ada" }).row;
    const t = app.touches.create({ person_id: p.id, channel: "email", direction: "giden", summary: "merhaba" }).row;
    const task = app.tasks.create({ title: "ara", person_id: p.id }).row;
    app.save("comment", { target_type: "task", target_id: task.id, body: "not" });
    app.save("comment", { target_type: "person", target_id: p.id, body: "kişi notu" });
    app.remove("person", p.id);
    expect(sql("SELECT COUNT(*) n FROM touches")[0].n).toBe(0);
    expect(sql("SELECT COUNT(*) n FROM tasks")[0].n).toBe(0);
    expect(sql("SELECT COUNT(*) n FROM comments")[0].n).toBe(0);
    expect(sql("SELECT COUNT(*) n FROM trash")[0].n).toBe(1);
    app.restore("person", p.id);
    expect(sql("SELECT id FROM touches").map((r) => r.id)).toEqual([t.id]);
    expect(sql("SELECT id FROM tasks").map((r) => r.id)).toEqual([task.id]);
    expect(sql("SELECT COUNT(*) n FROM comments")[0].n).toBe(2);
    expect(sql("SELECT type FROM events WHERE type LIKE '%.restored'").map((r) => r.type)).toEqual(["person.restored"]);
  });

  it("deleting a company takes its own touches and lets go of its tasks and people; restoring ties them back", () => {
    const c = app.companies.create({ name: "ABC" }).row;
    const p = app.people.create({ name: "Ada", company_id: c.id }).row;
    const direct = app.touches.create({ company_id: c.id, channel: "linkedin", direction: "giden", summary: "firma" }).row;
    const viaPerson = app.touches.create({ person_id: p.id, channel: "email", direction: "giden", summary: "kişi" }).row;
    const task = app.tasks.create({ title: "firma işi", company_id: c.id }).row;
    app.remove("company", c.id);
    expect(sql("SELECT id FROM touches").map((r) => r.id)).toEqual([viaPerson.id]);
    expect(sql("SELECT company_id FROM tasks WHERE id = ?", task.id)[0].company_id).toBeNull();
    expect(app.get("person", p.id).row.company_id).toBeNull();
    app.restore("company", c.id);
    expect(sql("SELECT id FROM touches ORDER BY id").map((r) => r.id)).toEqual([direct.id, viaPerson.id]);
    expect(sql("SELECT company_id FROM tasks WHERE id = ?", task.id)[0].company_id).toBe(c.id);
    expect(app.get("person", p.id).row.company_id).toBe(c.id);
  });

  it("deleting an opportunity or project lets go of the touches and tasks that point at it", () => {
    const p = app.people.create({ name: "Ada" }).row;
    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: app.get("source", "R10").row.id }).row;
    const t = app.touches.create({ person_id: p.id, opportunity_id: o.id, channel: "email", direction: "giden", summary: "teklif" }).row;
    const task = app.tasks.create({ title: "hazırla", opportunity_id: o.id }).row;
    app.remove("opportunity", o.id);
    expect(sql("SELECT opportunity_id FROM touches WHERE id = ?", t.id)[0].opportunity_id).toBeNull();
    expect(sql("SELECT opportunity_id FROM tasks WHERE id = ?", task.id)[0].opportunity_id).toBeNull();
    app.restore("opportunity", o.id);
    expect(sql("SELECT opportunity_id FROM touches WHERE id = ?", t.id)[0].opportunity_id).toBe(o.id);
    expect(sql("SELECT opportunity_id FROM tasks WHERE id = ?", task.id)[0].opportunity_id).toBe(o.id);
  });

  it("a draft marked as sent writes its touch through the network module and moves the opportunity stage", () => {
    const p = app.people.create({ name: "Ada", email: "ada@x.example" }).row;
    const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: app.get("source", "R10").row.id }).row;
    const d = app.drafts.create({ person_id: p.id, channel: "email", body: "merhaba" }).row;
    const sent = app.drafts.markSent(d.id);
    expect(sent.touch.draft_id).toBe(d.id);
    expect(sent.effects).toEqual(expect.arrayContaining([`temas #${sent.touch.id} oluştu`, "Ada: yazıldı", `fırsat #${o.id} → temas`]));
    expect(app.get("opportunity", o.id).row.stage).toBe("temas");
    const bare = appWithout(["network"], h, "owner", clock);
    const d2 = bare.mod("drafts")!.create({ person_id: p.id, channel: "email", body: "ikinci" }).row;
    const sent2 = bare.mod("drafts")!.markSent(d2.id);
    expect(sent2.touch).toBeUndefined();
    expect(sent2.effects).toEqual([]);
    expect(bare.mod("drafts")!.create({ person_id: p.id, channel: "email", body: "x" }).row.status).toBe("bekliyor");
  });

  describe("removal: each module can be switched off and the rest keeps running", () => {
    const seed = () => {
      const c = app.companies.create({ name: "ABC", website: "https://abc.example" }).row;
      const p = app.people.create({ name: "Ada", email: "ada@abc.example", company_id: c.id, tags: ["Sıcak"], next_follow_up_at: "2026-10-14" }).row;
      const o = app.opportunities.create({ title: "Site", person_id: p.id, source_id: app.get("source", "R10").row.id, estimated_value: 1000 }).row;
      app.touches.create({ person_id: p.id, opportunity_id: o.id, channel: "email", direction: "giden", summary: "merhaba", happened_at: "2026-10-13T09:00:00Z" });
      app.touches.create({ contact: "loose@x.example", channel: "email", direction: "giden", summary: "adres" });
      app.tasks.create({ title: "ara", person_id: p.id });
      app.save("comment", { target_type: "person", target_id: p.id, body: "selam" });
      app.save("comment", { target_type: "company", target_id: c.id, body: "firma" });
      app.drafts.create({ person_id: p.id, channel: "email", body: "taslak" });
      return { c, p, o };
    };
    const matrix: string[][] = [["people"], ["companies"], ["network"], ["people", "companies", "network"], ["calendar"], ["posts"], ["pipeline"], ["projects"], ["pipeline", "projects"], ["drafts"], ["templates"], ["ideas"], ["own-projects"], ["referrals"], ["drafts", "templates", "ideas", "own-projects", "referrals"]];

    it.each(matrix)("without %s", (...off) => {
      const { c, p, o } = seed();
      const bare = appWithout(off, h, "owner", clock);
      expect(bare.modules.list().map((m) => m.key)).not.toEqual(expect.arrayContaining(off));
      // the views and aggregators answer, with less in them
      const today = bare.today(50);
      // the follow-ups of people and of opportunities are filled by their modules: nothing of a module that is off
      expect(today.follow_ups?.people?.total ?? 0).toBe(off.includes("people") ? 0 : 1);
      // the drafts, follow-ups and quota of the Today view are the drafts module's
      for (const key of ["drafts", "followups", "quota"]) (off.includes("drafts") ? expect(today).not : expect(today)).toHaveProperty(key);
      for (const call of [() => bare.mod("reports")!.marketing(), () => bare.mod("reports")!.review(), () => bare.mod("reports")!.report(), () => bare.find("trash"),
        ...(off.includes("drafts") ? [] : [() => bare.find("draft")]), () => bare.find("comment"), () => bare.find("note"), () => bare.ctx.mod("posts")?.stats(), () => bare.mod("reports")!.month("2026-10"), () => bare.ctx.mod("calendar")?.calendar("2026-10-01", "2026-10-31"),
        ...(off.includes("pipeline") ? [] : [() => bare.find("opportunity"), () => bare.get("opportunity", o.id, ["comments", ...(off.includes("drafts") ? [] : ["drafts"])]), () => bare.mod("timeline")?.forRecord("opportunity", o.id)]),
        ...(off.includes("projects") ? [] : [() => bare.find("project"), () => bare.find("payment")])]) {
        expect(call).not.toThrow();
      }
      // the opportunity and project records of a missing module are a clear error, the rest of the views read zero
      if (off.includes("pipeline")) {
        expect(() => bare.find("opportunity")).toThrow(/"opportunity" türü için "pipeline" modülü kurulu değil/);
        expect(() => bare.move("opportunity", o.id, "temas")).toThrow(FFError);
        expect(today.follow_ups?.opportunities).toBeUndefined();
        expect(bare.mod("reports")!.bySource()).toEqual([]);
        // the opportunity count column of the sources list is the pipeline's
        expect(bare.find("source").rows.find((s) => s.name === "R10")).not.toHaveProperty("opp_count");
      } else expect(bare.find("source").rows.find((s) => s.name === "R10")).toMatchObject({ opp_count: 1 });
      if (off.includes("projects")) {
        expect(() => bare.find("project")).toThrow(/"project" türü için "projects" modülü kurulu değil/);
        expect(() => bare.find("payment")).toThrow(/"payment" türü için "projects" modülü kurulu değil/);
        expect(today).not.toHaveProperty("payments");
        expect(bare.mod("reports")!.month("2026-10")).toMatchObject({ collected: 0, outstanding_due: 0 });
      } else expect(today.payments.total).toBe(0);
      // the records of a missing module are a clear error, the others keep working
      if (off.includes("people")) {
        expect(() => bare.find("person")).toThrow(/"person" türü için "people" modülü kurulu değil/);
        expect(() => bare.save("person", { name: "x" })).toThrow(FFError);
        expect(bare.find("opportunity").rows[0]).toMatchObject({ person_name: "Ada" });
      } else expect(bare.find("person").total).toBe(1);
      if (off.includes("companies")) {
        expect(() => bare.find("company")).toThrow(/"company" türü için "companies" modülü kurulu değil/);
        if (!off.includes("people")) expect(() => bare.save("person", { name: "y", company: "Yeni Firma" })).toThrow(/"companies" modülü kurulu değil/);
      } else expect(bare.get("company", c.id).row.name).toBe("ABC");
      if (off.includes("network")) {
        expect(() => bare.find("touch")).toThrow(/"touch" türü için "network" modülü kurulu değil/);
        expect(today).not.toHaveProperty("network");
        expect(today).not.toHaveProperty("week");
        if (!off.includes("people")) expect(bare.ctx.mod("people")!.card(p.id)).toMatchObject({ channels: [], touches: { rows: [], total: 0 } });
        if (!off.includes("people")) expect(bare.find("person").rows[0]).toMatchObject({ last_touch_at: null, awaiting: null });
      } else expect(bare.find("touch").total).toBe(2);
      if (!off.includes("people") && !off.includes("network")) expect(bare.get("person", p.id, ["touches", "channels"]).related.touches).toHaveLength(1);
      if (!off.includes("companies")) expect(bare.ctx.mod("companies")!.card(c.id).row.name).toBe("ABC");
      // comments on the records of a missing module are still listed, with an id label
      const threads = bare.find("comment", { filter: { resolved: "all" } }).rows.map((t) => t.target_label);
      expect(threads).toHaveLength(2);
      if (off.includes("people")) expect(threads).toContain(`#${p.id}`);
    });

    it("everything switched off at once still deletes what has no dependants and says why the rest cannot go", () => {
      const { p } = seed();
      const bare = appWithout(everyKey, h, "owner", clock);
      expect(bare.modules.list()).toEqual([]);
      expect(bare.today(5)).toMatchObject({ comments: { total: 2 } });
      expect(bare.today(5)).not.toHaveProperty("follow_ups");
      // a draft is the drafts module's: refused with a clear error while it is not installed
      expect(() => bare.save("draft", { contact: "z@x.example", channel: "email", body: "x" })).toThrow(/"draft" türü için "drafts" modülü kurulu değil/);
      expect(p).toBeTruthy();
    });
  });
});
