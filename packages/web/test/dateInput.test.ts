import { describe, expect, it } from "vitest";
import { parseDate } from "../src/lib/dateInput";

const TODAY = "2026-10-15";

describe("parseDate", () => {
  it("accepts a real ISO date", () => {
    expect(parseDate("2026-02-28", TODAY)).toBe("2026-02-28");
    expect(parseDate("2028-02-29", TODAY)).toBe("2028-02-29");
  });

  it("rejects an ISO date that does not exist", () => {
    expect(parseDate("2026-02-31", TODAY)).toBeNull();
    expect(parseDate("2026-13-45", TODAY)).toBeNull();
    expect(parseDate("2026-02-29", TODAY)).toBeNull();
  });

  it("rejects an impossible day typed the short way", () => {
    expect(parseDate("31.02", TODAY)).toBeNull();
    expect(parseDate("31 Şubat", TODAY)).toBeNull();
  });
});
