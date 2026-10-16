import { describe, expect, it } from "vitest";
import { createCore, FFError, openDb, type Clock } from "@fullfollow/core";
import { FEED_MAX_LIMIT } from "../src/constants";
import { appFor, company, event, feedKinds, fakePeople, fakeProjects, person, touch } from "./helpers";

const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };

describe("timeline as a module", () => {
  it("the feed pages newest first by a (created_at, id) cursor: no gaps, no repeats, ties on one second keep their order", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "owner", clock, [feedKinds]);
    // 130 events, two per second (a tie on created_at), written out of order of their time
    for (let i = 0; i < 65; i++) {
      const k = (i * 7) % 65;
      const at = `2026-10-14T${10 + Math.floor(k / 60)}:${String(k % 60).padStart(2, "0")}:00Z`;
      event(h, { type: "touch.created", at, summary: `a${i}` });
      event(h, { type: "task.done", at, summary: `b${i}`, by: "claude" });
    }
    const seen: { id: number; created_at: string }[] = [];
    const sizes: number[] = [];
    let before: string | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const page = app.timeline.feed({ before, limit: 50 });
      sizes.push(page.rows.length);
      seen.push(...page.rows);
      if (!page.next_before) break;
      before = page.next_before;
    }
    expect(sizes).toEqual([50, 50, 30]);
    expect(new Set(seen.map((r) => r.id)).size).toBe(130);
    const sorted = [...seen].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : b.id - a.id));
    expect(seen.map((r) => r.id)).toEqual(sorted.map((r) => r.id));
    expect(app.timeline.feed({ limit: 130 }).next_before).toBeNull();
    // a limit beyond the cap is cut to it; a bad cursor is a clear error
    expect(app.timeline.feed({ limit: 100000 }).rows).toHaveLength(130);
    expect(FEED_MAX_LIMIT).toBeLessThan(100000);
    expect(() => app.timeline.feed({ before: "garbage" })).toThrow(FFError);
    expect(() => app.timeline.feed({ limit: 0 })).toThrow(FFError);
  });

  it("the feed filters by kind, actor, date and text; rows carry the record chip and the amount of a payment", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "owner", clock, [feedKinds]);
    const ada = person(h, "Ada Lovelace");
    const acme = company(h, "Acme");
    event(h, { type: "touch.created", at: "2026-10-10T12:00:00Z", summary: "Giden mesaj", data: { touch_id: touch(h, { company_id: acme }) } });
    event(h, { type: "payment.paid", at: "2026-10-12T12:00:00Z", by: "owner", summary: "Ödeme alındı: %50 indirim", data: { amount: 1500 }, person_id: ada });
    event(h, { type: "task.done", at: "2026-10-13T12:00:00Z", by: "claude", summary: "Görev tamamlandı: Kerem" });
    event(h, { type: "person.updated", at: "2026-10-13T13:00:00Z", summary: "not a feed event", person_id: ada });
    const all = app.timeline.feed();
    expect(all.rows.map((r) => r.type)).toEqual(["gorev", "odeme", "temas"]);
    expect(all.rows.find((r) => r.type === "odeme")).toMatchObject({ amount: 1500, person_id: ada, rec: { kind: "person", id: ada, name: "Ada Lovelace" } });
    // the touch row carries the company the event does not
    expect(all.rows.find((r) => r.type === "temas")).toMatchObject({ company_id: acme, rec: { kind: "company", id: acme, name: "Acme" } });
    expect(all.rows.find((r) => r.type === "gorev")?.rec).toBeNull();
    expect(app.timeline.feed({ type: "odeme,temas" }).rows.map((r) => r.type)).toEqual(["odeme", "temas"]);
    expect(app.timeline.feed({ actor: "claude" }).rows.map((r) => r.type)).toEqual(["gorev"]);
    expect(app.timeline.feed({ since: "2026-10-12" }).rows).toHaveLength(2);
    expect(app.timeline.feed({ q: "%50" }).rows.map((r) => r.type)).toEqual(["odeme"]);
    expect(app.timeline.feed({ q: "kerem" }).rows).toHaveLength(1);
    // the search also finds the record an event names, not only its summary
    expect(app.timeline.feed({ q: "lovelace" }).rows.map((r) => r.type)).toEqual(["odeme"]);
    expect(app.timeline.feed({ type: "", actor: "" }).rows).toHaveLength(3);
    expect(() => app.timeline.feed({ type: "bad" })).toThrow(/geçersiz tür/);
    expect(() => app.timeline.feed({ actor: "x" })).toThrow(FFError);
  });

  it("a record's feed keeps its own events and those of the rows it owns; day headers count the whole day, whatever the filters", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "owner", clock, [feedKinds]);
    const ada = person(h, "Ada");
    const bob = person(h, "Bob");
    const at = "2026-10-13T12:00:00Z";
    event(h, { type: "touch.created", at, data: { touch_id: touch(h, { person_id: ada }) } });
    event(h, { type: "payment.paid", at, person_id: ada, data: { amount: 10 } });
    event(h, { type: "task.done", at, by: "claude", person_id: bob });
    const page = app.timeline.feed({ record: `person:${ada}`, actor: "owner", type: "odeme" });
    expect(page.rows.map((r) => r.type)).toEqual(["odeme"]);
    expect(page.total).toBe(1);
    expect(app.timeline.feed({ record: `person:${ada}` })).toMatchObject({ total: 2, day_counts: { [page.rows[0].day]: { owner: 2, claude: 1 } } });
    expect(app.timeline.feed().total).toBeUndefined();
    expect(() => app.timeline.feed({ record: "ada" })).toThrow(FFError);
  });

  it("the week strip counts Monday to Sunday against the week before, in SQL", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "owner", clock, [feedKinds, fakeProjects]);
    const noon = (d: string) => `2026-10-${d}T12:00:00Z`;
    // this week: 2026-10-12 to 2026-10-18
    event(h, { type: "touch.created", at: noon("12"), by: "owner" });
    event(h, { type: "touch.created", at: noon("14"), by: "claude" });
    event(h, { type: "task.done", at: noon("13"), by: "owner" });
    event(h, { type: "task.done", at: noon("18"), by: "owner" });
    event(h, { type: "payment.paid", at: noon("15"), by: "owner", data: { amount: 1500 } });
    event(h, { type: "payment.paid", at: noon("16"), by: "owner", data: { amount: 2500 } });
    event(h, { type: "draft.created", at: noon("14"), by: "claude" });
    event(h, { type: "draft.created", at: noon("17"), by: "claude" });
    event(h, { type: "draft.created", at: noon("17"), by: "owner" });
    event(h, { type: "person.updated", at: noon("14"), by: "owner" });
    // the week before and the week after
    event(h, { type: "touch.created", at: noon("11"), by: "owner" });
    event(h, { type: "touch.created", at: noon("06"), by: "claude" });
    event(h, { type: "task.done", at: noon("08"), by: "owner" });
    event(h, { type: "touch.created", at: noon("19"), by: "owner" });
    const week = app.timeline.week();
    expect(week).toEqual({
      start: "2026-10-12", me: 6, claude: 3, touches: 2, collections_amount: 4000, collections_count: 2, tasks_done: 2, claude_drafts: 2, claude_drafts_approved: 0,
      prev: { touches: 2, tasks_done: 1 },
    });
    // any date of a week asks for that week
    expect(app.timeline.week("2026-10-07")).toMatchObject({ start: "2026-10-05", touches: 2, tasks_done: 1, me: 2, claude: 1 });
    expect(() => app.timeline.week("soon")).toThrow(FFError);
  });

  it("a person's own timeline answers by alias or name, oldest first, and refuses other types", () => {
    const h = openDb(":memory:");
    const app = appFor(h, "owner", clock, [fakePeople]);
    const ada = person(h, "Ada Lovelace");
    for (let i = 1; i <= 3; i++) event(h, { type: "person.updated", at: `2026-10-0${i}T12:00:00Z`, summary: `u${i}`, person_id: ada, data: i === 2 ? { k: 1 } : undefined });
    expect(app.timeline.forRecord("person", ada).map((e) => e.summary)).toEqual(["u1", "u2", "u3"]);
    expect(app.timeline.forRecord("kişi", "Ada Lovelace", 2).map((e) => [e.summary, e.data])).toEqual([["u2", { k: 1 }], ["u3", null]]);
    expect(() => app.timeline.forRecord("sector", 1)).toThrow(/timeline için person, opportunity ya da project/);
    expect(() => app.timeline.forRecord("person", 999)).toThrow(/bulunamadı/);
    expect(() => app.timeline.forRecord("opportunity", 1)).toThrow(/"pipeline" modülü kurulu değil/);
  });

  it("without the modules that write events the feed is empty and the week strip is zero; a core without the module has no timeline", () => {
    const app = appFor(openDb(":memory:"), "owner", clock);
    expect(app.timeline.feed()).toEqual({ rows: [], next_before: null, day_counts: {} });
    expect(app.timeline.week()).toMatchObject({ start: "2026-10-12", me: 0, claude: 0, touches: 0, collections_amount: null, tasks_done: 0 });
    expect(createCore(openDb(":memory:"), "owner", clock).mod("timeline")).toBeUndefined();
  });
});
