// One counted lock on the page scroll: the form sheet and the expand overlay can be open together (a sheet opened from an overlay),
// and closing the inner one must not release the page while the outer one is still open.
interface Body {
  style: { overflow: string };
}

/** A lock on `body()`'s scroll: every `lock()` is paired with its own release; the page scrolls again when the last release came */
export function createScrollLock(body: () => Body) {
  let holders = 0;
  let before = "";
  return function lock(): () => void {
    const el = body();
    if (holders++ === 0) {
      before = el.style.overflow;
      el.style.overflow = "hidden";
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--holders === 0) el.style.overflow = before;
    };
  };
}

/** Lock the page scroll; call the returned function (in an effect cleanup) to let go */
export const lockScroll = createScrollLock(() => document.body);
