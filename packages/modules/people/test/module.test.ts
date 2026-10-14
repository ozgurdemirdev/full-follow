import { describe, expect, it } from "vitest";
import { defineModule, FFError, openDb, type Clock, type RecordTrashed } from "@fullfollow/core";
import { appFor } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

describe("people as a module", () => {
  it("people go through the generic save, find, get and delete, by their Turkish aliases; the introducer is given by name", () => {
    const app = appFor(openDb(":memory:"), "claude", clock);
    const ada = app.save("kişi", { name: "Ada Lovelace", email: "ada@x.example", tags: ["Sıcak"], sectors: ["Sağlık > Diş hekimi"] }).row;
    expect(app.get("person", ada.id).row).toMatchObject({ name: "Ada Lovelace", created_by: "claude", referral_value: null, tags: ["Sıcak"], sector_path: "Sağlık > Diş hekimi" });
    const bob = app.save("people", { name: "Bob", referred_by: "Ada Lovelace" }).row;
    expect(bob.referred_by_id).toBe(ada.id);
    // the referral value is the referrals module's: without it the field is there and empty; the tree is this module's
    expect(app.get("person", ada.id).row.referral_value).toBeNull();
    expect(app.people.referralTree()).toEqual([{ id: ada.id, name: "Ada Lovelace", referred_by_id: null, company_name: null }, { id: bob.id, name: "Bob", referred_by_id: ada.id, company_name: null }]);
    expect(app.get("person", ada.id, ["referrals"]).related.referrals.map((p: any) => p.id)).toEqual([bob.id]);
    expect(app.find("person", { q: "ada" }).total).toBe(1);
    expect(app.remove("person", bob.id).trash).toEqual({ type: "person", id: bob.id });
    expect(app.find("trash").rows[0]).toMatchObject({ type: "person", what: "kişi" });
    app.restore("person", "Bob");
    expect(app.get("person", bob.id).row.referred_by_id).toBe(ada.id);
  });

  it("a company given by name is refused with a clear error while the companies module is not installed", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    expect(() => app.save("person", { name: "Ada", company: "ABC Ltd" })).toThrow(/"companies" modülü kurulu değil/);
    expect(app.find("person").total).toBe(0);
    expect(() => app.save("company", { name: "ABC" })).toThrow(/"company" türü için "companies" modülü kurulu değil/);
  });

  it("without the network module a person has no touch state: empty rhythm, nothing awaited", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    const p = app.people.create({ name: "Ada" }).row;
    expect(app.find("person").rows[0]).toMatchObject({ id: p.id, last_touch_at: null, awaiting: null, cooling: false, days_since: 0 });
    expect(app.find("person").rows[0].rhythm).toHaveLength(12);
    const card = app.people.card(p.id);
    expect(card).toMatchObject({ channels: [], touches: { rows: [], total: 0 }, post: null });
    expect(() => app.get("person", p.id, ["touches"])).toThrow(/geçerli ilişkiler/);
    expect(() => app.people.card(999)).toThrow(FFError);
  });

  it("deleting a person tells the other modules (record.trashed) inside the delete transaction, before the row is taken", () => {
    const seen: RecordTrashed[] = [];
    const probe = defineModule({
      key: "probe",
      label: "Probe",
      hooks: { "record.trashed": (ctx, p: RecordTrashed) => { seen.push({ type: p.type, id: p.id, bin: p.bin }); return [`stage ${ctx.sqlite.prepare("SELECT COUNT(*) n FROM people").get().n}`]; } },
    });
    const app = appFor(openDb(":memory:"), "ozgur", clock, [probe]);
    const p = app.people.create({ name: "Ada" }).row;
    app.remove("person", p.id);
    expect(seen.map((s) => [s.type, s.id])).toEqual([["person", p.id]]);
    // the hook ran while the person row still existed (its effects are not part of a delete result)
    expect(app.find("trash").total).toBe(1);
  });

  it("a hook that fails on record.trashed rolls the delete back", () => {
    const boom = defineModule({ key: "boom", label: "Boom", hooks: { "record.trashed": () => { throw new FFError("rule", "cleanup failed"); } } });
    const app = appFor(openDb(":memory:"), "ozgur", clock, [boom]);
    const p = app.people.create({ name: "Ada" }).row;
    expect(() => app.remove("person", p.id)).toThrow("cleanup failed");
    expect(app.find("person").total).toBe(1);
    expect(app.find("trash").total).toBe(0);
  });

  it("a bulk save skips duplicates, names them, and writes one bulk.skipped event with the keys", () => {
    const app = appFor(openDb(":memory:"), "claude", clock);
    const r = app.saveMany("person", [{ name: "A", email: "a@x.example" }, { name: "A kopya", email: "A@X.example" }, { name: "B" }]);
    expect(r.created).toHaveLength(2);
    expect(r.skipped).toMatchObject([{ index: 1, label: "A kopya", existing: { type: "person", field: "e-posta" } }]);
    const ev = app.ctx.sqlite.prepare("SELECT summary, data FROM events WHERE type = 'bulk.skipped'").all() as { summary: string; data: string }[];
    expect(ev).toHaveLength(1);
    expect(ev[0].summary).toBe("Toplu eklemede 1 mükerrer kişi atlandı");
    expect(JSON.parse(ev[0].data)).toEqual({ record_type: "person", count: 1, keys: ["email:a@x.example"] });
  });

  it("comments hang on a person and read its name; the module's record label and chat card exist", () => {
    const app = appFor(openDb(":memory:"), "ozgur", clock);
    const p = app.people.create({ name: "Ada" }).row;
    app.save("comment", { target_type: "person", target_id: p.id, body: "selam" });
    expect(app.find("comment").rows[0]).toMatchObject({ target_type: "person", target_label: "Ada" });
    expect(app.commentTargets()).toContain("person");
    expect(app.ctx.types.chatCard("person")!(app.ctx, p.id)).toMatchObject({ title: "Ada", draft_id: null });
    expect(() => app.save("comment", { target_type: "company", target_id: 1, body: "x" })).toThrow(/yorum yazılamaz/);
  });
});
