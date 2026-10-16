import { useLayoutEffect, useRef, type HTMLAttributes, type RefObject } from "react";
import { createPortal } from "react-dom";
import { placeFloating } from "../lib/floatingPlacement";

type Align = "start" | "end";

/**
 * Puts the panel next to the anchor in viewport coordinates. The gap is the panel's own vertical margin, so the stylesheet
 * keeps owning it; the panel flips above the anchor when it does not fit below and is kept inside the viewport.
 */
function place(anchor: HTMLElement, panel: HTMLElement, align: Align, matchWidth: boolean) {
  const a = anchor.getBoundingClientRect();
  const s = panel.style;
  s.maxHeight = "";
  s.overflowY = "";
  if (matchWidth) s.width = `${a.width}px`;
  const gap = parseFloat(getComputedStyle(panel).marginTop) || 0;
  const vh = document.documentElement.clientHeight;
  const { left, up, maxHeight } = placeFloating(a, panel.offsetWidth, panel.offsetHeight, gap, document.documentElement.clientWidth, vh, !matchWidth && align === "end");
  if (maxHeight !== null) {
    s.maxHeight = `${maxHeight}px`;
    s.overflowY = "auto";
  }
  s.left = `${left}px`;
  s.right = "auto";
  s.top = up ? "auto" : `${a.bottom}px`;
  s.bottom = up ? `${vh - a.top}px` : "auto";
  panel.dataset.side = up ? "top" : "bottom";
}

/**
 * A panel that floats next to `anchor`: rendered on document.body with fixed position, so no ancestor's overflow can clip it.
 * Follows the anchor on scroll (of any container) and on resize while `open`; the panel stays mounted when closed
 * so a popover can animate out.
 */
export function Floating({ anchor, open, align = "end", matchWidth = false, panelRef, className, children, ...rest }: HTMLAttributes<HTMLDivElement> & {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  align?: Align;
  /** the panel is as wide as the anchor (a list under its field) */
  matchWidth?: boolean;
  panelRef?: RefObject<HTMLDivElement | null>;
  inert?: boolean;
}) {
  const own = useRef<HTMLDivElement>(null);
  const panel = panelRef ?? own;

  useLayoutEffect(() => {
    const a = anchor.current;
    const p = panel.current;
    if (!open || !a || !p) return;
    const go = () => place(a, p, align, matchWidth);
    go();
    window.addEventListener("scroll", go, true);
    window.addEventListener("resize", go);
    const watch = new ResizeObserver(go);
    watch.observe(p);
    watch.observe(a);
    return () => {
      window.removeEventListener("scroll", go, true);
      window.removeEventListener("resize", go);
      watch.disconnect();
    };
  }, [open, anchor, panel, align, matchWidth]);

  return createPortal(
    <div ref={panel} data-floating className={className ? `ff-floating ${className}` : "ff-floating"} {...rest}>{children}</div>,
    document.body,
  );
}
