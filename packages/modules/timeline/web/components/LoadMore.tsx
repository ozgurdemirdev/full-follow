import { useEffect, useRef } from "react";
import { m } from "../messages";
import { TL_PREFETCH_MARGIN } from "../timeline";

/** "Daha eski olaylar": pressed by hand, or by itself once it comes within reach of the viewport while the list is scrolled */
export function LoadMore({ onMore, busy }: { onMore: () => void; busy: boolean }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = button.current;
    if (!el || busy) return;
    // observing again after every page: a page too short to leave the margin asks for the next one at once
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onMore();
    }, { rootMargin: TL_PREFETCH_MARGIN });
    seen.observe(el);
    return () => seen.disconnect();
  }, [onMore, busy]);
  return <button ref={button} type="button" className="tlx-more" disabled={busy} onClick={onMore}>{m.olderEvents}</button>;
}
