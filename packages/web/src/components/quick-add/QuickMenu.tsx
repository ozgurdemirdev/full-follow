import { useEffect, useRef, type RefObject } from "react";
import { openSheet, type SheetKind } from "../../app/ui";
import { quickAddMark } from "../../lib/constants";
import { m as kit } from "../../messages";
import { parts } from "../../messages.parts";
import { BoardIcon } from "../boardIcons";
import { QuickPanel } from "./QuickPanel";
import { closeQuick, openQuick, registerHeader, toggleQuick, useHeaderMounted, useQuickOpen, type QuickHost } from "./store";
import { stroke as STROKE } from "../../styles/tokens.json";

const m = parts.quick;
const NOT_TYPING = "input, textarea, select, [contenteditable]";
const MODAL = '[role="dialog"][aria-modal="true"]';

/** While the menu is open: Esc and a press outside close it, and focus goes back to the button that opened it */
function useDismiss(open: boolean, root: RefObject<HTMLElement | null>, trigger: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const off = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Escape") return;
        closeQuick();
        trigger.current?.focus();
      } else if (!root.current?.contains(e.target as Node)) closeQuick();
    };
    window.addEventListener("keydown", off);
    window.addEventListener("pointerdown", off);
    return () => {
      window.removeEventListener("keydown", off);
      window.removeEventListener("pointerdown", off);
    };
  }, [open, root, trigger]);
}

/** The menu of one host (header button or floating button): scrim on phones, the list, and opening the picked form */
function Menu({ host, trigger }: { host: QuickHost; trigger: RefObject<HTMLElement | null> }) {
  const pick = (kind: SheetKind) => {
    closeQuick();
    // the form sheet returns focus to whatever had it when it opened: the button, not the menu that just went away
    trigger.current?.focus();
    openSheet(kind);
  };
  return (
    <>
      <button type="button" className="quick-scrim" aria-label={kit.close} tabIndex={-1} onClick={() => closeQuick()} />
      <QuickPanel host={host} onPick={pick} />
    </>
  );
}

/** "Yeni kayıt" in a page header: pill button with the N shortcut, the plus turns into a cross while the menu is open */
export function QuickAddButton() {
  const open = useQuickOpen("header");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(registerHeader, []);
  useDismiss(open, root, trigger);
  return (
    <div ref={root} className="quick-host">
      <button ref={trigger} type="button" className="quick-new" aria-haspopup="menu" aria-expanded={open} onClick={() => toggleQuick("header")}>
        <BoardIcon name="plus" className="quick-plus size-icon-md" stroke={STROKE.medium} />
        {m.title}
        <span className="quick-key">{m.shortcutKey}</span>
      </button>
      {open ? <Menu host="header" trigger={trigger} /> : null}
    </div>
  );
}

/** Floating + button: on phones everywhere, on desktop only on pages without the header button */
export function QuickAddFab() {
  const open = useQuickOpen("fab");
  const covered = useHeaderMounted();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useDismiss(open, root, trigger);
  return (
    <div ref={root}>
      <button ref={trigger} type="button" className="quick-fab" aria-label={m.title} aria-haspopup="menu" aria-expanded={open} data-covered={covered} {...quickAddMark("fab")} onClick={() => toggleQuick("fab")}>
        <BoardIcon name="plus" className="quick-plus size-icon-2xl" stroke={STROKE.bold} />
      </button>
      {open ? <Menu host="fab" trigger={trigger} /> : null}
    </div>
  );
}

/** The N key opens the menu unless a field has focus or a dialog is open */
export function useQuickShortcut() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.target as HTMLElement | null)?.closest?.(NOT_TYPING) || document.querySelector(MODAL)) return;
      e.preventDefault();
      openQuick();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
