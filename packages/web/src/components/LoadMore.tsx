import { useEffect, useRef } from "react";
import { LOAD_MORE_MARGIN_PX } from "../lib/constants";

/**
 * The end of an endless list: when it comes close to the window the next page is asked for. Nothing is drawn while there is no more.
 * The observer is rebuilt when a page has landed (`loaded` changed), so an end that is still in view keeps asking until it is not,
 * and it calls the latest `onMore`, so a new callback never rebuilds it.
 */
export function LoadMore({ hasMore, loaded, onMore }: { hasMore: boolean; loaded: number; onMore: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  const more = useRef(onMore);
  useEffect(() => {
    more.current = onMore;
  });
  useEffect(() => {
    const el = end.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && more.current(), { rootMargin: `${LOAD_MORE_MARGIN_PX}px` });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loaded]);
  return hasMore ? <div ref={end} aria-hidden="true" className="h-px" /> : null;
}
