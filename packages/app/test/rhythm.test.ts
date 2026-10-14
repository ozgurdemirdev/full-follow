import { beforeEach, describe, expect, it } from "vitest";
import { openDb, RHYTHM_WEEKS, type Clock } from "@fullfollow/core";
import { appFor, suite } from "./helpers";

suite("Weekly contact rhythm", () => {
  // Wednesday: the current ISO week starts on Monday 2026-10-12, the window on Monday 2026-07-27
  const clock: Clock = { today: () => "2026-10-14", now: () => "2026-10-14T10:00:00Z" };
  let core: ReturnType<typeof appFor>;
  beforeEach(() => {
    core = appFor(openDb(":memory:"), "ozgur", clock);
  });

  it("counts touches per ISO week, oldest first and the current week last; weeks without touches are 0", () => {
    const p = core.people.create({ name: "Elif Kaya" }).row;
    const idle = core.people.create({ name: "Can Demir" }).row;
    const touch = (happened_at: string) => core.touches.create({ person_id: p.id, channel: "email", direction: "giden", summary: "x", happened_at });
    touch("2026-10-14");
    touch("2026-10-12");
    touch("2026-10-11");
    touch("2026-07-27");
    touch("2026-07-26");
    const rows = core.find("person", { limit: 10 }).rows;
    const rhythm = rows.find((r: any) => r.id === p.id).rhythm as number[];
    expect(rhythm).toHaveLength(RHYTHM_WEEKS);
    expect(rhythm[RHYTHM_WEEKS - 1]).toBe(2);
    expect(rhythm[RHYTHM_WEEKS - 2]).toBe(1);
    expect(rhythm[0]).toBe(1);
    expect(rhythm.reduce((a, b) => a + b, 0)).toBe(4);
    expect(rhythm.slice(1, RHYTHM_WEEKS - 2).every((n) => n === 0)).toBe(true);
    expect(rows.find((r: any) => r.id === idle.id).rhythm).toEqual(new Array(RHYTHM_WEEKS).fill(0));
  });
});
