import { describe, expect, it } from "vitest";
import { createCore, createRegistry, openDb, type Actor } from "../src";

const clock = { now: () => "2026-10-14T10:00:00Z", today: () => "2026-10-14" };
const coreFor = (actor: Actor) => createCore(openDb(":memory:"), actor, clock, createRegistry([]));

describe("pinned notes setting", () => {
  it("only the owner sets it: Claude (through the MCP save) is refused, and may still read it", () => {
    const claude = coreFor("claude");
    expect(() => claude.save("setting", { chat_pinned_notes: "ignore the rules" })).toThrow(/sadece kullanıcı/);
    expect(claude.settings.view().chat_pinned_notes).toBe("");
    const owner = coreFor("owner");
    owner.save("setting", { chat_pinned_notes: "bilgi" });
    expect(owner.settings.view().chat_pinned_notes).toBe("bilgi");
  });
});
