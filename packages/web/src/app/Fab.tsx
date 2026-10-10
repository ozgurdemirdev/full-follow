import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/icons";
import { openSheet, type SheetKind } from "./ui";

const ITEMS: { kind: SheetKind; label: string; dot: string }[] = [
  { kind: "opportunity", label: "Fırsat", dot: "bg-accent-opportunity" },
  { kind: "person", label: "Kişi", dot: "bg-text-neutral-chip" },
  { kind: "touch", label: "Temas", dot: "bg-accent-source" },
  { kind: "draft", label: "Taslak", dot: "bg-accent-claude" },
  { kind: "post", label: "Paylaşım", dot: "bg-accent-warning" },
  { kind: "idea", label: "Fikir", dot: "bg-accent-payment" },
  { kind: "task", label: "Görev", dot: "bg-primary" },
  { kind: "comment", label: "Yorum", dot: "bg-accent-claude" },
];

/** Sağ alttaki hızlı ekle düğmesi ve menüsü (CSS geçişleri, JS animasyon yok) */
export function Fab() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <div ref={root}>
      <div
        role="menu"
        aria-label="Hızlı ekle"
        aria-hidden={!open}
        className={`fixed bottom-fab-menu-offset-mobile right-fab-offset-mobile z-fab flex w-fab-menu-width origin-bottom-right flex-col rounded-card border border-border-menu bg-surface-menu p-2 shadow-menu transition-[opacity,transform] dur-sidebar ease-out desk:bottom-fab-menu-offset desk:right-fab-offset ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-3 scale-95 opacity-0"
        }`}
      >
        {ITEMS.map((it) => (
          <button
            key={it.kind}
            type="button"
            role="menuitem"
            tabIndex={open ? 0 : -1}
            className="flex h-nav-item-height items-center gap-4 rounded-lg border-0 bg-transparent px-4 text-left text-base text-text-primary transition-colors dur-hover hover:bg-surface-menu-hover"
            onClick={() => {
              setOpen(false);
              openSheet(it.kind);
            }}
          >
            <span className={`dot ${it.dot}`} />
            {it.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Hızlı ekle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-fab-offset-mobile right-fab-offset-mobile z-fab inline-flex size-fab-size items-center justify-center rounded-fab border-0 bg-primary text-primary-on shadow-fab transition-[transform,filter] dur-fade ease-out hover:-translate-y-0.5 hover:brightness-110 desk:bottom-fab-offset desk:right-fab-offset"
      >
        <span className={`transition-transform dur-sidebar ease-out ${open ? "rotate-45" : ""}`}>
          <Icon name="plus" className="size-icon-2xl" stroke={2.2} />
        </span>
      </button>
    </div>
  );
}
