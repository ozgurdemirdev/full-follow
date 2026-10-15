import { describe, expect, it } from "vitest";
import { addDays, isIsoDate, isIsoDateTime, resolveRelativeDate } from "../src";

describe("date validation", () => {
  it("a date that does not exist is not an ISO date, a real one (leap days included) is", () => {
    for (const s of ["2026-13-45", "2026-02-31", "2026-00-10", "2026-10-00", "2026-04-31", "2025-02-29", "1900-02-29", "2026-10-1", "26-10-10"]) expect(isIsoDate(s), s).toBe(false);
    for (const s of ["2026-10-15", "2024-02-29", "2000-02-29", "2026-12-31", "0099-01-01"]) expect(isIsoDate(s), s).toBe(true);
  });

  it("a date time needs a real date and a real time of day", () => {
    for (const s of ["2026-02-31T10:00:00", "2026-13-01T10:00", "2026-10-15T24:00:00", "2026-10-15T10:60", "2026-10-15T10:00:60", "2026-10-15 10:00", "2026-02-31"]) expect(isIsoDateTime(s), s).toBe(false);
    for (const s of ["2026-10-15", "2026-10-15T09:30", "2026-10-15T09:30:00Z", "2026-10-15T09:30:00.123+03:00", "2024-02-29T23:59:59"]) expect(isIsoDateTime(s), s).toBe(true);
  });

  it("every relative date resolves to a real day", () => {
    for (const today of ["2026-10-15", "2026-02-28", "2024-02-29", "2026-12-31"]) {
      for (const input of ["bugün", "yarın", "dün", "yarin", "today", "tomorrow", "yesterday", "+3g", "-2g", "+1h", "+40", "-400g"]) {
        const r = resolveRelativeDate(input, today) as string;
        expect(isIsoDate(r), `${input} from ${today} gave ${r}`).toBe(true);
      }
    }
    expect(resolveRelativeDate("+1h", "2026-02-28")).toBe(addDays("2026-02-28", 7));
  });
});
