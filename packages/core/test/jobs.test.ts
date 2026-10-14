import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCore, createRegistry, defineModule, openDb, startJobs, type JobDef } from "../src";

const clock = { now: () => "2026-10-14T10:00:00Z", today: () => "2026-10-14" };

describe("scheduled jobs", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const appWith = (jobs: JobDef[]) => createCore(openDb(":memory:"), "claude", clock, createRegistry([defineModule({ key: "ticker", label: "Ticker", contribute: { jobs } })]));

  it("a module's jobs reach the host, run as the app they are given, first after firstRunMs and then every everyMs", async () => {
    const seen: string[] = [];
    const app = appWith([{ name: "tick", everyMs: 1000, firstRunMs: 100, run: (a) => void seen.push(a.actor) }]);
    expect(app.jobs().map((j) => j.name)).toEqual(["tick"]);
    const stop = startJobs(app.jobs(), app);
    await vi.advanceTimersByTimeAsync(99);
    expect(seen).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(seen).toEqual(["claude"]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(seen).toHaveLength(3);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(seen).toHaveLength(3);
  });

  it("a job that is still running is not started again, and a failing run is logged without stopping the schedule", async () => {
    let release!: () => void;
    let starts = 0;
    const warn = vi.fn();
    const slow: JobDef = { name: "slow", everyMs: 10, run: () => { starts++; return new Promise<void>((r) => (release = r)); } };
    const bad: JobDef = { name: "bad", everyMs: 10, run: () => { throw new Error("boom"); } };
    const app = appWith([slow, bad]);
    const stop = startJobs(app.jobs(), app, warn);
    await vi.advanceTimersByTimeAsync(55);
    expect(starts).toBe(1);
    expect(warn).toHaveBeenCalledWith("  bad: boom");
    expect(warn.mock.calls.length).toBeGreaterThan(2);
    release();
    await vi.advanceTimersByTimeAsync(10);
    expect(starts).toBe(2);
    stop();
  });

  it("a disabled job never starts, and a module that is off contributes none", () => {
    const run = vi.fn();
    const off = { name: "off", everyMs: 10, enabled: () => false, run };
    const app = appWith([off]);
    const stop = startJobs(app.jobs(), app);
    vi.advanceTimersByTime(100);
    expect(run).not.toHaveBeenCalled();
    stop();
    const without = createCore(openDb(":memory:"), "claude", clock, createRegistry([defineModule({ key: "ticker", label: "T", contribute: { jobs: [off] } })], ["ticker"]));
    expect(without.jobs()).toEqual([]);
  });
});
