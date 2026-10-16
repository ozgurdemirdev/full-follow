import { describe, expect, it } from "vitest";
import { FLOATING_MARGIN_PX } from "../src/lib/constants";
import { placeFloating, type Rect } from "../src/lib/floatingPlacement";

const trigger = (top: number, right = 700): Rect => ({ left: right - 80, right, top, bottom: top + 40, width: 80 });

describe("floating panel placement", () => {
  it("opens below the trigger when it fits", () => {
    expect(placeFloating(trigger(100), 200, 300, 8, 1440, 900, true)).toEqual({ left: 500, up: false, maxHeight: null });
  });

  it("opens above when it does not fit below and there is more room above", () => {
    expect(placeFloating(trigger(700), 200, 300, 8, 1440, 900, true).up).toBe(true);
  });

  it("stays below when above is no roomier, and scrolls inside when too tall", () => {
    const p = placeFloating(trigger(10), 200, 2000, 8, 1440, 900, true);
    expect(p.up).toBe(false);
    expect(p.maxHeight).toBe(900 - 50 - 8 - FLOATING_MARGIN_PX);
  });

  it("keeps clear of the window edges", () => {
    expect(placeFloating(trigger(100, 1435), 200, 100, 8, 1440, 900, false).left).toBe(1440 - 200 - FLOATING_MARGIN_PX);
    expect(placeFloating(trigger(100, 90), 200, 100, 8, 1440, 900, true).left).toBe(FLOATING_MARGIN_PX);
  });
});
