import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { layout, radius } from "../styles/tokens.json";
import { dur, ease, overlayRise } from "../lib/motion";
import { BoardIcon } from "./boardIcons";
import { MotionScope } from "./MotionScope";

const px = (s: string) => parseInt(s, 10);
const MOBILE_MAX = px(layout["breakpoint-mobile"]);
const FOCUSABLE = "a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex='-1'])";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Full viewport minus the gap (smaller on phones) */
function fullBox(): Box {
  const w = document.documentElement.clientWidth;
  const gap = px(w <= MOBILE_MAX ? layout["overlay-gap-mobile"] : layout["overlay-gap"]);
  return { top: gap, left: gap, width: w - gap * 2, height: window.innerHeight - gap * 2 };
}

const fromRect = (r: DOMRect): Box => ({ top: r.top, left: r.left, width: r.width, height: r.height });

/** State for one overlay on a page: `show(key, rect)` from a card's onExpand, `hide()` to close */
export function useExpand<K extends string = string>() {
  const [state, set] = useState<{ key: K; from: DOMRect } | null>(null);
  return { key: state?.key ?? null, from: state?.from ?? null, show: (key: K, from: DOMRect) => set({ key, from }), hide: () => set(null) };
}

/** Footer call to action: page link with the arrow circle */
export function ExpandLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="ff-ex-link">
      {children}
      <span><BoardIcon name="arrowRight" className="size-icon-xs" stroke={2.2} /></span>
    </Link>
  );
}

/**
 * A card grown to the full viewport: opens from the rect of the source card, closes back into it.
 * Esc and a click on the backdrop close it; focus stays inside and returns to where it was.
 * With reduced motion it only fades.
 */
export function ExpandOverlay({ open, from, title, sub, toolbar, footer, header, bodyClassName, onClose, children }: {
  open: boolean;
  /** rect of the card it grows from */
  from: DOMRect | null;
  title: string;
  sub?: ReactNode;
  /** row under the title (a search field, pills) */
  toolbar?: ReactNode;
  footer?: ReactNode;
  /** own header instead of the title row (a record: avatar, name, actions); it must hold a [data-close] button */
  header?: ReactNode;
  /** class of the scrolling body (replaces the list padding) */
  bodyClassName?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return createPortal(
    <MotionScope>
      <AnimatePresence>
        {open && from ? <Panel key="panel" from={fromRect(from)} title={title} sub={sub} toolbar={toolbar} footer={footer} header={header} bodyClassName={bodyClassName} onClose={onClose}>{children}</Panel> : null}
      </AnimatePresence>
    </MotionScope>,
    document.body,
  );
}

function Panel({ from, title, sub, toolbar, footer, header, bodyClassName, onClose, children }: {
  from: Box;
  title: string;
  sub?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  bodyClassName?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLElement>(null);
  const [full, setFull] = useState(fullBox);

  useEffect(() => {
    const onResize = () => setFull(fullBox());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // focus moves in, the page behind does not scroll, focus goes back to the opener on close
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("[data-close]")?.focus();
    return () => {
      document.body.style.overflow = "";
      opener?.focus?.();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
    else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
  };

  const grow = { duration: dur.overlay, ease: ease.out };
  const body = (delay: number, y = 0) => ({
    initial: { opacity: 0, y },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, transition: { duration: dur.fade } },
    transition: { duration: y ? dur["overlay-slide"] : dur["overlay-body"], delay, ease: ease.out },
  });
  const box = reduce ? { ...full, borderRadius: radius.overlay } : undefined;

  return (
    <div className="fixed inset-0 z-overlay" onKeyDown={onKeyDown}>
      <m.button
        type="button"
        aria-label="Kapat"
        tabIndex={-1}
        className="ff-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: dur["overlay-fade"] }}
        onClick={onClose}
      />
      <m.section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ff-ex"
        tabIndex={-1}
        initial={reduce ? { opacity: 0, ...box } : { ...from, borderRadius: radius.card }}
        animate={reduce ? { opacity: 1, ...box } : { ...full, borderRadius: radius.overlay }}
        exit={reduce ? { opacity: 0 } : { ...from, borderRadius: radius.card }}
        transition={reduce ? { duration: dur.fade } : grow}
      >
        {header ? (
          <div className="ff-ex-rec">{header}</div>
        ) : (
          <div className="ff-ex-top">
            <div className="ff-ex-title">
              <div className="ff-ex-titles">
                <h2>{title}</h2>
                {sub ? <m.span className="ff-ex-sub" {...body(dur["overlay-body-delay"])}>{sub}</m.span> : null}
              </div>
              <button type="button" className="ff-ex-close" data-close aria-label="Küçült" onClick={onClose}>
                <BoardIcon name="shrink" className="size-icon-btn" stroke={2.2} />
              </button>
            </div>
            {toolbar ? <m.div {...body(dur["overlay-body-delay"])}>{toolbar}</m.div> : null}
          </div>
        )}
        <m.div className={bodyClassName ?? "ff-ex-list"} {...body(dur["overlay-slide-delay"], overlayRise)}>{children}</m.div>
        {footer ? <m.div className="ff-ex-foot" {...body(dur["overlay-body-delay"])}>{footer}</m.div> : null}
      </m.section>
    </div>
  );
}
