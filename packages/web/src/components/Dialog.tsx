import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { m } from "../messages";

const FOCUSABLE = "button:not([tabindex='-1']), input, textarea, select";

/**
 * The app's centered dialog: Esc, the backdrop and the caller's cancel button close it, Tab stays inside, the first control takes the
 * focus and the opener gets it back on close. The caller fills it with `dlg-title`, `dlg-text` and a `dlg-foot` of `dlg-btn` buttons.
 */
export function Dialog({ label, onCancel, children }: { label: string; onCancel: () => void; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return cancel.current();
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
    };
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  // on the body: a parent with a transform (a lifted card) would otherwise become the box the fixed dialog centers in
  return createPortal(
    <>
      <button type="button" className="dlg-scrim" aria-label={m.cancel} tabIndex={-1} onClick={onCancel} />
      <section ref={panel} className="dlg" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </section>
    </>,
    document.body,
  );
}
