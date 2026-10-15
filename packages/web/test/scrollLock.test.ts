import { describe, expect, it } from "vitest";
import { createScrollLock } from "../src/lib/scrollLock";

describe("scroll lock", () => {
  it("keeps the page locked until the last holder lets go", () => {
    const body = { style: { overflow: "" } };
    const lock = createScrollLock(() => body);
    const overlay = lock();
    const sheet = lock();
    expect(body.style.overflow).toBe("hidden");
    sheet();
    expect(body.style.overflow).toBe("hidden");
    overlay();
    expect(body.style.overflow).toBe("");
  });

  it("gives back what the page had before", () => {
    const body = { style: { overflow: "scroll" } };
    const lock = createScrollLock(() => body);
    const release = lock();
    release();
    expect(body.style.overflow).toBe("scroll");
  });

  it("counts a release once", () => {
    const body = { style: { overflow: "" } };
    const lock = createScrollLock(() => body);
    const a = lock();
    lock();
    a();
    a();
    expect(body.style.overflow).toBe("hidden");
  });
});
