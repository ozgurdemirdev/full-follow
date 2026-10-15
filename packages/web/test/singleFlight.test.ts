import { describe, expect, it } from "vitest";
import { createSingleFlight } from "../src/lib/singleFlight";

describe("single flight", () => {
  it("drops a call made while the first one is still running", async () => {
    const once = createSingleFlight();
    let release!: () => void;
    let runs = 0;
    const first = once(() => new Promise<void>((done) => { runs++; release = done; }));
    const second = once(async () => { runs++; });
    expect(await second).toBeUndefined();
    release();
    await first;
    expect(runs).toBe(1);
  });

  it("runs again once the task settled, also after a failure", async () => {
    const once = createSingleFlight();
    await once(async () => { throw new Error("down"); }).catch(() => {});
    expect(await once(async () => "ok")).toBe("ok");
  });
});
