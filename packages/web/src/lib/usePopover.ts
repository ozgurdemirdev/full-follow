import { useEffect, useRef, useState } from "react";

const FOCUSABLE = "a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex='-1'])";

/**
 * Open state of a small popover. `root` wraps the trigger, `panel` is the floating panel (it lives on document.body, so a press
 * inside it is not inside `root`). Closes on Esc and on a press outside both; focus moves into the panel on open and goes back to
 * the trigger when Esc or Tab leaves it.
 */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = () => root.current?.querySelector<HTMLElement>("button");
    const items = () => [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    items()[0]?.focus();
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        const list = items();
        const edge = e.key === "Tab" && list.length > 0 && document.activeElement === list[e.shiftKey ? 0 : list.length - 1];
        if (e.key !== "Escape" && !edge) return;
        if (edge) e.preventDefault();
        setOpen(false);
      } else if (!root.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
      if (panel.current?.contains(document.activeElement)) trigger()?.focus();
    };
  }, [open]);

  return { open, setOpen, root, panel };
}
