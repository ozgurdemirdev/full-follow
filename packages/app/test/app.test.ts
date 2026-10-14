import { describe, expect, it } from "vitest";
import { createCore, openDb } from "@fullfollow/core";
import { createApp } from "../src";
import { modules, modulesOff } from "../src/modules.generated";

describe("createApp", () => {
  it("with the generated module list it has today's core surface plus the module registry view", () => {
    const app = createApp(openDb(":memory:"), "ozgur");
    const core = createCore(openDb(":memory:"), "ozgur");
    expect(Object.keys(app).sort()).toEqual(Object.keys(core).sort());
    expect(app.modules.list().map((m) => m.key)).toEqual(modules.map((m) => m.key));
  });

  it("with no modules it behaves like core: save, find and a hook-free event", () => {
    if (modules.length) return;
    const app = createApp(openDb(":memory:"), "claude");
    const saved = app.save("person", { name: "Ada Lovelace" });
    expect(saved.row.created_by).toBe("claude");
    expect(app.find("person", { q: "ada" }).rows).toHaveLength(1);
  });

  it("the generated list is well formed", () => {
    expect(new Set(modules.map((m) => m.key)).size).toBe(modules.length);
    expect(Array.isArray(modulesOff)).toBe(true);
  });
});
