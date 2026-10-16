import { describe, expect, it } from "vitest";
import { createCore, createRegistry, FFError, openDb } from "../src";

const clock = { now: () => "2026-10-16T10:00:00Z", today: () => "2026-10-16" };
const makeCore = (actor: "owner" | "claude" = "owner") => createCore(openDb(":memory:"), actor, clock, createRegistry([]));

describe("auto draft settings", () => {
  it("default to on with Sonnet at medium effort, store a switch and the whitelisted model and effort", () => {
    const core = makeCore();
    expect(core.settings.all()).toMatchObject({ draft_auto: true, draft_model: "claude-sonnet-5-5", draft_effort: "medium" });
    core.settings.setMany({ draft_auto: false, draft_model: "claude-haiku-5-5", draft_effort: "high" });
    expect(core.settings.all()).toMatchObject({ draft_auto: false, draft_model: "claude-haiku-5-5", draft_effort: "high" });
    core.settings.setMany({ draft_auto: "1" });
    expect(core.settings.all().draft_auto).toBe(true);
  });

  it("refuse a model or effort off the list, and a value that is not a switch, without saving any of them", () => {
    const core = makeCore();
    expect(() => core.settings.setMany({ draft_model: "gpt-4" })).toThrow(FFError);
    expect(() => core.settings.setMany({ draft_effort: "max" })).toThrow(FFError);
    expect(() => core.settings.setMany({ draft_auto: "maybe", draft_effort: "low" })).toThrow(FFError);
    expect(core.settings.all()).toMatchObject({ draft_auto: true, draft_effort: "medium" });
  });

  it("are the owner's: Claude cannot turn them on or pick the model", () => {
    const claude = makeCore("claude");
    expect(() => claude.settings.setMany({ draft_model: "claude-opus-5-5" })).toThrow(FFError);
    expect(() => claude.settings.setMany({ draft_auto: true })).toThrow(FFError);
  });
});
