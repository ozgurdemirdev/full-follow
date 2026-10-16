import { describe, expect, it } from "vitest";
import { createCore, createRegistry, defineModule, FFError, openDb, type Ctx, type ModuleDef } from "../src";
import { emit as writeEvent, rows, stamp } from "../src/context";
import { people } from "../src/db/schema";

const mk = (key: string, extra: Partial<ModuleDef> = {}): ModuleDef => defineModule({ key, label: key.toUpperCase(), ...extra });

/** A context bound to a registry, the way createCore builds it. */
function ctxFor(defs: ModuleDef[], off: string[] = []) {
  const handle = openDb(":memory:");
  const registry = createRegistry(defs, off);
  const ctx = { db: handle.db, sqlite: handle.sqlite, actor: "owner", clock: { now: () => "2026-10-14T10:00:00Z", today: () => "2026-10-14" } } as Ctx;
  Object.assign(ctx, registry.bind(ctx));
  return { ctx, registry };
}

describe("module registry", () => {
  it("rejects a duplicate key, even when one of the two is switched off", () => {
    expect(() => createRegistry([mk("a"), mk("a")])).toThrow(FFError);
    expect(() => createRegistry([mk("a"), mk("a")], ["a"])).toThrow(/duplicate module key "a"/);
  });

  it("rejects a malformed key", () => {
    expect(() => mk("Bad Key")).toThrow(FFError);
  });

  it("respects the off list: has, list and mod hide a switched off module", () => {
    const defs = [mk("a", { api: () => ({ n: 1 }) }), mk("b", { api: () => ({ n: 2 }) })];
    const { ctx, registry } = ctxFor(defs, ["b", "ghost"]);
    expect(registry.has("a")).toBe(true);
    expect(registry.has("b")).toBe(false);
    expect(registry.list().map((m) => m.key)).toEqual(["a"]);
    expect(registry.off()).toEqual(["b", "ghost"]);
    expect(ctx.mod("a")).toEqual({ n: 1 });
    expect(ctx.mod("b")).toBeUndefined();
  });

  it("mod() is undefined for a missing module and for one without an api, and the api is created once", () => {
    let made = 0;
    const { ctx } = ctxFor([mk("a", { api: () => ({ id: ++made }) }), mk("quiet")]);
    expect(ctx.mod("nope")).toBeUndefined();
    expect(ctx.mod("quiet")).toBeUndefined();
    expect(ctx.mod("a")).toBe(ctx.mod("a"));
    expect(made).toBe(1);
  });

  it("a module api can reach another module through ctx.mod, and sees undefined when it is off", () => {
    const user = mk("user", { api: (c) => ({ other: () => c.mod("other") }) });
    const other = mk("other", { api: () => ({ hi: true }) });
    const on = ctxFor([user, other]).ctx.mod("user") as { other(): unknown };
    expect(on.other()).toEqual({ hi: true });
    const off = ctxFor([user, other], ["other"]).ctx.mod("user") as { other(): unknown };
    expect(off.other()).toBeUndefined();
  });

  it("createCore with no registry has no modules; with one it exposes them", () => {
    const bare = createCore(openDb(":memory:"), "owner");
    expect(bare.modules.list()).toEqual([]);
    const withMods = createCore(openDb(":memory:"), "owner", undefined, createRegistry([mk("a")]));
    expect(withMods.modules.has("a")).toBe(true);
    expect(withMods.modules.has("b")).toBe(false);
  });
});

describe("event bus", () => {
  it("runs hooks in registration order and concatenates their effects; hooks without the event or without a return are skipped", () => {
    const calls: string[] = [];
    const defs = [
      mk("a", { hooks: { "x.happened": () => { calls.push("a"); return ["a1", "a2"]; } } }),
      mk("b", { hooks: { "y.happened": () => { calls.push("b-wrong"); return ["no"]; } } }),
      mk("c", { hooks: { "x.happened": (_c, p) => { calls.push(`c:${p.n}`); } } }),
      mk("d", { hooks: { "x.happened": () => ["d1"] } }),
    ];
    const { ctx } = ctxFor(defs);
    const effects = ctx.sqlite.transaction(() => ctx.emit("x.happened", { n: 7 }))();
    expect(calls).toEqual(["a", "c:7"]);
    expect(effects).toEqual(["a1", "a2", "d1"]);
  });

  it("hookOrder moves a module's hook after or before the others of that event, per event; the rest keep key order", () => {
    const calls: string[] = [];
    const on = (name: string) => () => { calls.push(name); return [name]; };
    const defs = [
      mk("a", { hooks: { e: on("a"), f: on("a-f") }, hookOrder: { e: 10 } }),
      mk("b", { hooks: { e: on("b"), f: on("b-f") } }),
      mk("c", { hooks: { e: on("c") }, hookOrder: { e: -1 } }),
    ];
    const { ctx } = ctxFor(defs);
    expect(ctx.sqlite.transaction(() => ctx.emit("e", {}))()).toEqual(["c", "b", "a"]);
    // another event is not affected
    expect(ctx.sqlite.transaction(() => ctx.emit("f", {}))()).toEqual(["a-f", "b-f"]);
    expect(calls).toEqual(["c", "b", "a", "a-f", "b-f"]);
  });

  it("an event nobody listens to returns no effects", () => {
    const { ctx } = ctxFor([]);
    expect(ctx.sqlite.transaction(() => ctx.emit("nobody", {}))()).toEqual([]);
  });

  it("hooks of a switched off module never run", () => {
    let ran = false;
    const { ctx } = ctxFor([mk("a", { hooks: { e: () => { ran = true; } } })], ["a"]);
    ctx.sqlite.transaction(() => ctx.emit("e", {}))();
    expect(ran).toBe(false);
  });

  it("a hook sees only the installed modules through ctx.mod", () => {
    let seen: unknown = "unset";
    const defs = [mk("a", { hooks: { e: (c) => { seen = c.mod("b"); } } }), mk("b", { api: () => ({}) })];
    const { ctx } = ctxFor(defs, ["b"]);
    ctx.sqlite.transaction(() => ctx.emit("e", {}))();
    expect(seen).toBeUndefined();
  });

  it("refuses to run outside a transaction", () => {
    const { ctx } = ctxFor([mk("a", { hooks: { e: () => [] } })]);
    expect(() => ctx.emit("e", {})).toThrow(/inside the caller's transaction/);
  });

  it("a throwing hook rolls back the whole transaction: the triggering row and its events row", () => {
    const boom = mk("boom", { hooks: { "person.added": () => { throw new FFError("rule", "hook failed"); } } });
    const { ctx } = ctxFor([boom]);
    const addPerson = () => ctx.db.transaction((tx) => {
      tx.insert(people).values({ name: "Ada", ...stamp(ctx) }).run();
      writeEvent(tx, ctx, { type: "person.added", summary: "Ada added" });
      return ctx.emit("person.added", { name: "Ada" });
    });
    expect(addPerson).toThrow("hook failed");
    expect(rows(ctx, "SELECT id FROM people")).toEqual([]);
    expect(rows(ctx, "SELECT id FROM events")).toEqual([]);

    // control: without the failing module the same transaction commits both rows
    const ok = ctxFor([mk("fine", { hooks: { "person.added": () => ["fine ran"] } })]).ctx;
    const effects = ok.db.transaction((tx) => {
      tx.insert(people).values({ name: "Ada", ...stamp(ok) }).run();
      writeEvent(tx, ok, { type: "person.added", summary: "Ada added" });
      return ok.emit("person.added", { name: "Ada" });
    });
    expect(effects).toEqual(["fine ran"]);
    expect(rows(ok, "SELECT id FROM people")).toHaveLength(1);
    expect(rows(ok, "SELECT id FROM events")).toHaveLength(1);
  });
});
