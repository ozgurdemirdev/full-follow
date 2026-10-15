import { describe, expect, it } from "vitest";
import { createRecordCache } from "../web/recordCache";

const rows = [{ type: "person", id: 1 }] as never;

describe("record cache of the chat chips", () => {
  it("never holds more blocks than its maximum, the oldest go first", () => {
    const cache = createRecordCache(3);
    for (const k of ["a", "b", "c", "d", "e"]) cache.set(k, rows);
    expect(cache.size()).toBe(3);
    expect(cache.has("a")).toBe(false);
    expect(cache.has("b")).toBe(false);
    expect(cache.has("e")).toBe(true);
  });

  it("a block written again counts as new", () => {
    const cache = createRecordCache(2);
    cache.set("a", rows);
    cache.set("b", rows);
    cache.set("a", rows);
    cache.set("c", rows);
    expect(cache.has("a")).toBe(true);
    expect(cache.has("b")).toBe(false);
  });

  it("clear empties it, so a reopened session fetches fresh rows", () => {
    const cache = createRecordCache(5);
    cache.set("a", rows);
    cache.clear();
    expect(cache.has("a")).toBe(false);
    expect(cache.size()).toBe(0);
  });
});
