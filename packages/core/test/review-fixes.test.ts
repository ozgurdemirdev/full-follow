import { describe, expect, it } from "vitest";
import { FFError, intId, intQuery, LIST_LIMIT_MAX, listLimit, listOpts } from "../src";

describe("numeric query values", () => {
  it("intQuery returns undefined when absent and a 400 (http) when not an integer within bounds", () => {
    expect(intQuery("count", undefined, 1, 60)).toBeUndefined();
    expect(intQuery("count", "12", 1, 60)).toBe(12);
    for (const bad of ["abc", "1.5", "0", "61", "20000", "-1", "1e3", ["1", "2"]]) {
      expect(() => intQuery("count", bad, 1, 60), String(bad)).toThrow(FFError);
    }
  });

  it("list limit is a positive integer cut to the maximum; offset is zero or more; text is refused instead of returning nothing", () => {
    expect(listOpts({ limit: "5", offset: "10", q: "x", city: "a" })).toEqual({ q: "x", limit: 5, offset: 10, filter: { city: "a" } });
    expect(listOpts({}).limit).toBeUndefined();
    expect(listLimit("100000")).toBe(LIST_LIMIT_MAX);
    for (const query of [{ limit: "abc" }, { limit: "-1" }, { limit: "0" }, { offset: "-1" }, { offset: "x" }]) {
      expect(() => listOpts(query), JSON.stringify(query)).toThrow(FFError);
    }
  });

  it("an id from a URL is a small whole number as typed: no decimals, hex or numbers past what a double holds", () => {
    expect(intId("42")).toBe(42);
    for (const bad of ["100000000000000000000", "1.5", "0x10", "0", "-3", "abc", ""]) expect(() => intId(bad), bad).toThrow(FFError);
  });
});
