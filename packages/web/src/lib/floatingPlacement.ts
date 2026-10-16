import { FLOATING_MARGIN_PX } from "./constants";

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
}

export interface Placement {
  left: number;
  /** the panel opens above the anchor instead of below it */
  up: boolean;
  /** set when the panel is taller than the room on its side: it then scrolls inside */
  maxHeight: number | null;
}

/**
 * Where a panel of `w` x `h` goes next to `anchor` in a `vw` x `vh` window. Below by default, above when it does not fit
 * below and there is more room above; never closer than FLOATING_MARGIN_PX to an edge. `gap` is the space between anchor and panel.
 */
export function placeFloating(a: Rect, w: number, h: number, gap: number, vw: number, vh: number, alignEnd: boolean): Placement {
  const below = vh - a.bottom - gap - FLOATING_MARGIN_PX;
  const above = a.top - gap - FLOATING_MARGIN_PX;
  const up = h > below && above > below;
  const room = up ? above : below;
  const left = alignEnd ? a.right - w : a.left;
  return {
    left: Math.max(FLOATING_MARGIN_PX, Math.min(left, vw - w - FLOATING_MARGIN_PX)),
    up,
    maxHeight: h > room ? Math.max(room, 0) : null,
  };
}
