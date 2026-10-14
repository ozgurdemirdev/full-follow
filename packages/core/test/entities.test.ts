import { describe, expect, it } from "vitest";
import { createCore, createRegistry, defineModule, FFError, openDb, type EntityHandler, type ModuleDef } from "../src";
import { trash } from "../src/db/schema";

const now = "2026-10-14T10:00:00Z";
const clock = { now: () => now, today: () => "2026-10-14" };

/** A module that owns the record type "widget", kept in memory: enough to exercise the generic dispatch. */
function widgets() {
  const store = new Map<number, { id: number; name: string }>();
  const entity: EntityHandler = {
    aliases: ["aparat", "widgets"],
    related: ["comments"],
    save: (_ctx, data, id) => {
      const row = { id: id ?? store.size + 1, name: String(data.name) };
      store.set(row.id, row);
      return { row, effects: ["widget kaydedildi"] };
    },
    get: (_ctx, id) => store.get(id),
    find: (_ctx, o) => {
      const list = [...store.values()].filter((w) => !o.q || w.name.includes(o.q));
      return { rows: list.slice(o.offset, (o.offset ?? 0) + (o.limit ?? 20)), total: list.length };
    },
    delete: (_ctx, id) => {
      store.delete(id);
      return { effects: [], trash: { type: "widget", id } };
    },
  };
  const def: ModuleDef = defineModule({
    key: "widgets", label: "Aparatlar", entities: { widget: entity },
    contribute: { trashTypes: [{ type: "widget", label: "aparat" }], recordLabels: { widget: "aparat" } },
  });
  return { def, store };
}

const makeCore = (defs: ModuleDef[], off: string[] = []) => createCore(openDb(":memory:"), "ozgur", clock, createRegistry(defs, off));

describe("registry driven record types", () => {
  it("save, get, find and delete go to the module's handler, by canonical name or alias", () => {
    const core = makeCore([widgets().def]);
    expect(core.normalizeType("Aparat")).toBe("widget");
    expect(core.save("widget", { name: "alfa" })).toMatchObject({ row: { id: 1, name: "alfa" }, effects: ["widget kaydedildi"] });
    core.save("aparat", { name: "beta" });
    core.save("widget", { name: "alfa 2" }, 1);
    expect(core.get("widget", 1).row).toEqual({ id: 1, name: "alfa 2" });
    expect(core.find("widgets", { q: "beta" })).toEqual({ rows: [{ id: 2, name: "beta" }], total: 1 });
    expect(core.remove("widget", 2).trash).toEqual({ type: "widget", id: 2 });
    expect(() => core.get("widget", 2)).toThrow(FFError);
  });

  it("get only takes the relations the type names", () => {
    const core = makeCore([widgets().def]);
    core.save("widget", { name: "alfa" });
    expect(core.get("widget", 1, ["comments"]).related.comments).toEqual([]);
    expect(() => core.get("widget", 1, ["touches"])).toThrow(/geçerli ilişkiler: comments/);
  });

  it("a type that is not installed is a clear error, and core types keep working", () => {
    const core = makeCore([widgets().def], ["widgets"]);
    expect(() => core.normalizeType("widget")).toThrow(/bilinmeyen tür "widget"/);
    expect(() => core.save("widget", { name: "x" })).toThrow(FFError);
    expect(core.save("sector", { name: "Sağlık" }).row.id).toBe(1);
    expect(core.find("sektör", { q: "sağ" }).total).toBe(1);
  });

  it("a type without a handler for the operation says so", () => {
    const def = defineModule({ key: "ro", label: "RO", entities: { readonly: { find: () => ({ rows: [], total: 0 }) } } });
    const core = makeCore([def]);
    expect(core.find("readonly").total).toBe(0);
    expect(() => core.save("readonly", {})).toThrow(/save desteklenmiyor/);
    expect(() => core.remove("readonly", 1)).toThrow(/delete desteklenmiyor/);
  });

  it("two modules cannot claim the same type name or alias", () => {
    const a = defineModule({ key: "a", label: "A", entities: { widget: { aliases: ["x"] } } });
    const b = defineModule({ key: "b", label: "B", entities: { gadget: { aliases: ["x"] } } });
    expect(() => createRegistry([a, b])).toThrow(/claimed twice/);
  });

  it("restore takes the module's trash types and labels them; an unregistered type is refused", () => {
    const core = makeCore([widgets().def]);
    const h = openDb(":memory:");
    const c = createCore(h, "ozgur", clock, createRegistry([widgets().def]));
    h.db.insert(trash).values({ type: "widget", record_id: 7, label: "alfa", payload: JSON.stringify({ parts: [], links: [] }), created_at: now, updated_at: now, created_by: "ozgur" }).run();
    expect(c.find("trash").rows[0]).toMatchObject({ type: "widget", label: "alfa", what: "aparat" });
    expect(c.restore("widget", 7).effects).toEqual(["alfa geri yüklendi"]);
    expect(c.find("trash").total).toBe(0);
    expect(() => core.restore("gadget", 1)).toThrow(/bilinmeyen tür "gadget"/);
    const bare = makeCore([]);
    expect(() => bare.restore("widget", 1)).toThrow(/bilinmeyen tür "widget"/);
  });

  it("a module type with a ref is looked up by name or id", () => {
    const def = defineModule({ key: "origins", label: "Kaynaklar", entities: { origin: { ref: { table: "sources", col: "name", label: "kaynak" } } } });
    const core = makeCore([def]);
    const id = core.resolveRef("source", "R10");
    expect(core.resolveRef("origin", "R10")).toBe(id);
    expect(core.resolveRef("origin", `#${id}`)).toBe(id);
    expect(() => core.resolveRef("origin", "yok böyle bir kaynak")).toThrow(/bulunamadı/);
    expect(() => makeCore([]).resolveRef("origin", "R10")).toThrow(/isimle verilemez/);
  });
});
