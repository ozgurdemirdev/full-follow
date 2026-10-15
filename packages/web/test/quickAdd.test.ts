import { describe, expect, it } from "vitest";
import { quickAddMark, quickAddSelector } from "../src/lib/constants";

describe("quick add marks", () => {
  it("the selector the mascot uses matches the attribute the kit puts on the button and the menu", () => {
    for (const part of ["fab", "menu"] as const) {
      const [[attr, value]] = Object.entries(quickAddMark(part));
      expect(quickAddSelector(part)).toBe(`[${attr}="${value}"]`);
    }
  });

  it("never selects by a label", () => {
    expect(quickAddSelector("fab")).not.toMatch(/aria-label/);
  });
});
