import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { layout, space } from "../styles/tokens.json";

const MOBILE_MAX = parseInt(layout["breakpoint-mobile"], 10);
const MEDIUM_MAX = parseInt(layout["breakpoint-medium"], 10);
/** space between the cards of one column; counted so a column with more cards does not look shorter than it is */
const COLUMN_GAP = parseInt(space["9"], 10);

const subscribeResize = (fn: () => void) => (window.addEventListener("resize", fn), () => window.removeEventListener("resize", fn));

/** Column count at the current width: one on phones, at most two up to the medium breakpoint */
function useColumns(wanted: number) {
  return useSyncExternalStore(subscribeResize, () => {
    const w = window.innerWidth;
    return w <= MOBILE_MAX ? 1 : w <= MEDIUM_MAX ? Math.min(wanted, 2) : wanted;
  });
}

/**
 * n independent columns: each child goes, in order, to the column that is shortest at that moment
 * (measured heights, re-balanced when a card changes size or the width changes). The children stay mounted
 * while they move between columns (each lives in its own host element that is moved, not re-created).
 * `pinned` fixes children (by key) to a column index while all `columns` are shown; the rest then fill the
 * shortest column after them. With fewer columns (tablet, phone) everything flows in child order.
 */
export function Masonry({ columns, pinned, children }: { columns: number; pinned?: Record<string, number>; children: ReactNode }) {
  const n = useColumns(columns);
  const cols = useRef<(HTMLDivElement | null)[]>([]);
  const [hosts] = useState(() => new Map<string, HTMLDivElement>());
  const items = Children.toArray(children).filter(isValidElement);
  const keys = items.map((c) => String(c.key));
  const signature = keys.join("|");

  const place = () => {
    const targets = cols.current.slice(0, n);
    if (targets.some((t) => !t)) return;
    const totals = targets.map(() => 0);
    const groups: HTMLDivElement[][] = targets.map(() => []);
    // Children.toArray prefixes keys with ".$"
    const fixed = (key: string) => (n === columns ? pinned?.[key.replace(/^\.\$/, "")] : undefined);
    const put = (host: HTMLDivElement, k: number) => {
      groups[k].push(host);
      totals[k] += host.offsetHeight + COLUMN_GAP;
    };
    for (const key of keys) {
      const host = hosts.get(key);
      const col = fixed(key);
      if (host && col !== undefined) put(host, col);
    }
    for (const key of keys) {
      const host = hosts.get(key);
      if (host && fixed(key) === undefined) put(host, totals.indexOf(Math.min(...totals)));
    }
    groups.forEach((group, k) => {
      group.forEach((host, i) => {
        if (targets[k]!.children[i] !== host) targets[k]!.insertBefore(host, targets[k]!.children[i] ?? null);
      });
    });
  };

  // attach first (heights are still unknown), then measure and place again, all before paint
  useLayoutEffect(() => {
    for (const [k, host] of hosts) {
      if (!keys.includes(k)) (host.remove(), hosts.delete(k));
    }
    // a host that is not attached yet has no height: the second pass is only for those, every other render needs one forced layout
    const fresh = keys.some((k) => !hosts.get(k)?.isConnected);
    place();
    if (fresh) place();
  });

  useEffect(() => {
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    });
    hosts.forEach((h) => ro.observe(h));
    return () => (cancelAnimationFrame(frame), ro.disconnect());
    // place reads the current keys and column count: both are covered by these
  }, [signature, n]);

  const hostFor = (key: string) => {
    let host = hosts.get(key);
    if (!host) hosts.set(key, (host = document.createElement("div")));
    return host;
  };

  return (
    <>
      <div className="ff-masonry" style={{ ["--cols" as string]: n } as CSSProperties}>
        {Array.from({ length: n }, (_, i) => <div key={i} className="ff-col" ref={(el) => void (cols.current[i] = el)} />)}
      </div>
      {items.map((c, i) => createPortal(c, hostFor(keys[i]), keys[i]))}
    </>
  );
}

/** Tile list in CSS columns (3, 2 up to the medium breakpoint, 1 on phones): tiles keep their own height */
export function TileColumns({ children }: { children: ReactNode }) {
  return <div className="ff-tiles">{children}</div>;
}

/** Two panels side by side, stretched to the same height; stacked on phones */
export function Pair({ children }: { children: ReactNode }) {
  return <div className="ff-pair">{children}</div>;
}
