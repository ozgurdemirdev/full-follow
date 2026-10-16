import { describe, expect, it } from "vitest";
import { defineModule, FFError, openDb, type Clock, type TouchCreated, type TouchUpdated } from "@fullfollow/core";
import { appFor, fakeIdeas } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };
const mail = (summary: string, extra: Record<string, unknown> = {}) => ({ contact: "info@x.example", channel: "email", direction: "giden", summary, ...extra });

describe("network as a module", () => {
  it("touches go through the generic save, find, get and delete; an outgoing message waits for an answer", () => {
    const app = appFor(openDb(":memory:"), "claude", clock);
    const t = app.save("temas", mail("merhaba")).row;
    expect(app.get("touch", t.id).row).toMatchObject({ summary: "merhaba", created_by: "claude", expects_reply: true, to_name: "info@x.example", person_id: null });
    expect(app.find("touch", { filter: { loose: true } }).total).toBe(1);
    app.save("touch", { expects_reply: false }, t.id);
    expect(app.get("touch", t.id).row.expects_reply).toBe(false);
    expect(() => app.save("touch", { expects_reply: true }, app.save("touch", mail("gelen", { direction: "gelen" })).row.id)).toThrow(/sadece giden temas/);
    expect(app.remove("touch", t.id).trash).toEqual({ type: "touch", id: t.id });
    expect(app.find("trash").rows[0]).toMatchObject({ type: "touch", what: "temas", label: "Temas: merhaba" });
    app.restore("touch", t.id);
    expect(app.get("touch", t.id).row.summary).toBe("merhaba");
  });

  it("writing a touch emits touch.created with the row and the subject; hooks of other modules add effects before core's own rules", () => {
    const seen: TouchCreated[] = [];
    const probe = defineModule({ key: "probe", label: "Probe", hooks: { "touch.created": (_ctx, p: TouchCreated) => { seen.push(p); return ["probe ran"]; } } });
    const app = appFor(openDb(":memory:"), "owner", clock, [probe]);
    const r = app.network.touches.create(mail("ilk"));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ touch: { id: r.row.id, summary: "ilk" }, subject: { person_id: null, contact: "info@x.example" }, cold: true, input: { channel: "email", direction: "giden", kind: "mesaj" } });
    // the drafts module (send warnings) is not installed here: the other module's effect is all there is
    expect(r.effects[0]).toBe("probe ran");
    const second = app.network.touches.create(mail("ikinci"));
    expect(seen[1].cold).toBe(false);
    expect(second.effects[0]).toBe("probe ran");
  });

  it("editing a touch emits touch.updated with the fields that were sent; a failing hook rolls the edit back", () => {
    const seen: TouchUpdated[] = [];
    const probe = defineModule({ key: "probe", label: "Probe", hooks: { "touch.updated": (_c, p: TouchUpdated) => { seen.push(p); } } });
    const app = appFor(openDb(":memory:"), "owner", clock, [probe]);
    const t = app.network.touches.create(mail("ilk")).row;
    app.network.touches.update(t.id, { summary: "düzeltildi" });
    expect(seen[0]).toMatchObject({ touch: { id: t.id, summary: "düzeltildi" }, changes: { summary: "düzeltildi" } });
    const boom = defineModule({ key: "boom", label: "Boom", hooks: { "touch.updated": () => { throw new FFError("rule", "no edits"); } } });
    const strict = appFor(openDb(":memory:"), "owner", clock, [boom]);
    const u = strict.network.touches.create(mail("ilk")).row;
    expect(() => strict.network.touches.update(u.id, { summary: "x" })).toThrow("no edits");
    expect(strict.get("touch", u.id).row.summary).toBe("ilk");
  });

  it("without the people and companies modules nothing moves a status; the module still counts touches", () => {
    const app = appFor(openDb(":memory:"), "owner", clock);
    expect(app.network.touches.create(mail("a")).effects).toEqual([]);
    expect(app.network.stats().size).toBe(0);
    expect(app.network.weekStats()).toMatchObject({ week_start: "2026-10-12", this_week: { sent: 1, replies: 0, reply_rate: 0 }, open_offers: 0 });
    expect(app.network.lists().awaiting).toEqual({ rows: [], total: 0 });
    expect(app.network.adoptLoose({ person_id: 1 }, ["email:nobody@x.example"])).toEqual([]);
  });

  it("the Today view gets the network lists and the week numbers; the touch relation loads on a few types", () => {
    const app = appFor(openDb(":memory:"), "owner", clock, [fakeIdeas()]);
    app.network.touches.create(mail("a"));
    app.network.touches.create(mail("b", { direction: "gelen" }));
    const today = app.today();
    expect(today.network).toMatchObject({ awaiting: { total: 0 }, cooling: { total: 0 } });
    expect(today.week).toMatchObject({ sent: 1, replies: 1, sent_prev: 0 });
    const idea = app.save("idea", { title: "Klinik botu" }).row;
    expect(app.get("idea", idea.id, ["touches"]).related.touches).toEqual([]);
    expect(() => app.get("source", app.get("source", "R10").row.id, ["touches"])).toThrow(/geçerli ilişkiler/);
  });

  it("activity buckets, a bad period is refused", () => {
    const app = appFor(openDb(":memory:"), "owner", clock);
    app.network.touches.create(mail("a"));
    const a = app.network.activity("day");
    expect(a.buckets).toHaveLength(14);
    expect(a.current).toMatchObject({ start: "2026-10-14", sent: 1 });
    expect(() => app.network.activity("year")).toThrow(/dönem/);
  });

  it("an idea, opportunity or project that is deleted lets go of its touches; the touches stay", () => {
    const app = appFor(openDb(":memory:"), "owner", clock, [fakeIdeas()]);
    const idea = app.save("idea", { title: "Klinik botu" }).row;
    // an idea link needs a person: write the row by hand (the people module is not installed here)
    app.ctx.sqlite.prepare("INSERT INTO people (name, created_at, updated_at, created_by) VALUES ('Ada', ?, ?, 'owner')").run(clock.now(), clock.now());
    const t = app.network.touches.create({ person_id: 1, channel: "email", direction: "giden", summary: "fikir", idea_id: idea.id }).row;
    expect(app.find("touch", { filter: { idea_id: idea.id } }).total).toBe(1);
    app.remove("idea", idea.id);
    expect(app.get("touch", t.id).row.idea_id).toBeNull();
    app.restore("idea", idea.id);
    expect(app.get("touch", t.id).row.idea_id).toBe(idea.id);
  });
});
