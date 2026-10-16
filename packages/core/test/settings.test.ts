import { describe, expect, it } from "vitest";
import { createCore, createRegistry, defineModule, FFError, openDb, type ModuleDef } from "../src";

const clock = { now: () => "2026-10-14T10:00:00Z", today: () => "2026-10-14" };
const makeCore = (defs: ModuleDef[], off: string[] = []) => createCore(openDb(":memory:"), "owner", clock, createRegistry(defs, off));
const mod = (key: string) => defineModule({ key, label: key });

describe("modules_hidden setting", () => {
  it("starts empty, keeps only installed keys, and a list is stored once per key", () => {
    const core = makeCore([mod("a"), mod("b")]);
    expect(core.settings.view().modules_hidden).toEqual([]);
    core.settings.setMany({ modules_hidden: ["b", "a", "b"] });
    expect(core.settings.view().modules_hidden).toEqual(["b", "a"]);
    core.settings.setMany({ modules_hidden: "[\"a\"]" });
    expect(core.settings.view().modules_hidden).toEqual(["a"]);
    core.settings.setMany({ modules_hidden: [] });
    expect(core.settings.view().modules_hidden).toEqual([]);
  });

  it("refuses a key that is not an installed module, and a list that is not a list", () => {
    const core = makeCore([mod("a"), mod("b")], ["b"]);
    expect(() => core.settings.setMany({ modules_hidden: ["b"] })).toThrow(FFError);
    expect(() => core.settings.setMany({ modules_hidden: ["ghost"] })).toThrow(/kurulu olmayan modül: ghost/);
    expect(() => core.settings.setMany({ modules_hidden: "a" })).toThrow(FFError);
    expect(core.settings.view().modules_hidden).toEqual([]);
  });

  it("a stored key whose module is gone is not reported (it comes back with the module)", () => {
    const db = openDb(":memory:");
    const both = createCore(db, "owner", clock, createRegistry([mod("a"), mod("b")]));
    both.settings.setMany({ modules_hidden: ["a", "b"] });
    const withoutB = createCore(db, "owner", clock, createRegistry([mod("a"), mod("b")], ["b"]));
    expect(withoutB.settings.view().modules_hidden).toEqual(["a"]);
    expect(both.settings.view().modules_hidden).toEqual(["a", "b"]);
  });
});
