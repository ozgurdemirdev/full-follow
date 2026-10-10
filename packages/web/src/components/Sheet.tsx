import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useRef, type ReactNode } from "react";
import { dur, ease } from "../lib/motion";
import { useIsDesktop } from "../lib/media";
import { Icon } from "./icons";
import { MotionScope } from "./MotionScope";

/** Sağdan (masaüstü) ya da alttan (mobil) açılan form paneli. Esc ve arka plan tıklaması kapatır. */
export function Sheet({ open, title, onClose, children, footer }: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const desk = useIsDesktop();
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // ilk alana odaklan
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("input, textarea, select, button:not([aria-label='Kapat'])")?.focus(), 60);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  const hidden = desk ? { x: "100%" } : { y: "100%" };
  return (
    <MotionScope>
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-sheet flex items-end justify-end desk:items-stretch">
          <m.button
            type="button"
            aria-label="Kapat"
            tabIndex={-1}
            className="absolute inset-0 border-0 bg-bg-scrim p-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.fade }}
            onClick={onClose}
          />
          <m.section
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={hidden}
            animate={{ x: 0, y: 0 }}
            exit={hidden}
            transition={{ duration: dur.sheet, ease: ease.out }}
            className="relative flex max-h-dvh w-full flex-col overflow-y-auto rounded-t-sheet-mobile border-t border-border-sidebar bg-bg-canvas shadow-sheet desk:h-dvh desk:w-sheet-width desk:rounded-none desk:border-l desk:border-t-0"
          >
            <header className="flex items-center gap-5 border-b border-border-sidebar px-7 py-9 desk:px-10">
              <h2 className="m-0 flex-grow text-xl font-semibold">{title}</h2>
              <button type="button" className="ibtn" aria-label="Kapat" onClick={onClose}>
                <Icon name="close" />
              </button>
            </header>
            <div className="flex flex-grow flex-col gap-8 px-7 py-9 desk:px-10">{children}</div>
            {footer ? (
              <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-border-sidebar bg-bg-canvas px-7 py-7 desk:px-10">{footer}</footer>
            ) : null}
          </m.section>
        </div>
      ) : null}
    </AnimatePresence>
    </MotionScope>
  );
}

/** Etiketli alan */
export function Field({ label, htmlFor, children, className = "" }: { label: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {htmlFor ? <label htmlFor={htmlFor} className="lab">{label}</label> : <span className="lab">{label}</span>}
      {children}
    </div>
  );
}

/** Tek seçimli çip grubu (radio) */
export function ChipRadio<T extends string>({ items, value, onChange, label, claude }: {
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  claude?: T;
}) {
  return (
    <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="radio"
          aria-checked={it.value === value}
          className={`fchip h-control-height-xs ${it.value === claude ? "is-claude" : ""}`}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
