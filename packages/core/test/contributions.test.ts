import { describe, expect, it } from "vitest";
import { createCore, createRegistry, defineModule, FFError, openDb, type ModuleDef } from "../src";

const clock = { now: () => "2026-10-14T10:00:00Z", today: () => "2026-10-14" };
const makeCore = (defs: ModuleDef[], off: string[] = []) => createCore(openDb(":memory:"), "ozgur", clock, createRegistry(defs, off));

/** A module that adds a Today section, a relation on people and a meta list */
const pings = defineModule({
  key: "pings",
  label: "Pingler",
  contribute: {
    today: (_ctx, { limit }) => ({ pings: { rows: [], total: 0, limit } }),
    relations: { pings: { on: ["person"], load: (_ctx, by, limit) => [{ for_person: by.person_id, limit }] } },
    meta: { ping_kinds: ["kısa", "uzun"] },
  },
});

describe("contribution points", () => {
  it("Today gets the sections of the installed modules, with the row limit", () => {
    expect(makeCore([pings]).today(7).pings).toEqual({ rows: [], total: 0, limit: 7 });
    expect(makeCore([pings], ["pings"]).today()).not.toHaveProperty("pings");
  });

  it("get loads a module's relation on the types it names, and refuses it elsewhere or when the module is off", () => {
    const core = makeCore([pings]);
    const p = core.people.create({ name: "Ada" }).row;
    expect(core.get("person", p.id, ["pings"], 5).related.pings).toEqual([{ for_person: p.id, limit: 5 }]);
    const c = core.companies.create({ name: "ABC" }).row;
    expect(() => core.get("company", c.id, ["pings"])).toThrow(FFError);
    const off = makeCore([pings], ["pings"]);
    const q = off.people.create({ name: "Ada" }).row;
    expect(() => off.get("person", q.id, ["pings"])).toThrow(/geçerli ilişkiler/);
  });

  it("moduleMeta merges the meta of the installed modules", () => {
    const other = defineModule({ key: "other", label: "Öteki", contribute: { meta: { other_kinds: ["a"] } } });
    expect(makeCore([pings, other]).moduleMeta()).toEqual({ ping_kinds: ["kısa", "uzun"], other_kinds: ["a"] });
    expect(makeCore([pings, other], ["other"]).moduleMeta()).toEqual({ ping_kinds: ["kısa", "uzun"] });
    expect(makeCore([]).moduleMeta()).toEqual({});
  });
});
