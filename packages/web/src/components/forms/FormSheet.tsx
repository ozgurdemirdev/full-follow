import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { layout, motion } from "../../styles/tokens.json";
import { FORM_ICON, PathIcon } from "./icons";

const px = (s: string) => parseInt(s, 10);
const ms = (s: string) => parseFloat(s);
/** how far the grab handle is dragged down on a phone before the sheet closes */
const DRAG_CLOSE = px(layout["form-drag-close"]);
const EXIT_MS = ms(motion.duration["form-sheet-out"]);
const FOCUSABLE = "a[href], button:not([disabled]), input:not([tabindex='-1']), textarea, select, [tabindex]:not([tabindex='-1'])";
const FIRST_FIELD = "input:not([type='hidden']):not([tabindex='-1']), textarea";
const FOCUS_DELAY = 60;

export interface FormSheetProps {
  open: boolean;
  title: string;
  /** path of the type icon in the header */
  icon: string;
  /** where the record lands ("Kişiler’e eklenir") */
  dest: string;
  /** id of the <form> the Kaydet button submits */
  formId: string;
  busy: boolean;
  saveLabel: string;
  /** edit mode: the ghost "Sil" button on the left */
  onDelete?: () => void;
  onClose: () => void;
  /** banners above the fields (duplicate, error summary) */
  banners?: ReactNode;
  children: ReactNode;
}

/**
 * The one form panel: a side sheet on desktop, a bottom sheet with a grab handle on phones.
 * Esc and a click on the backdrop close it, Tab stays inside, focus goes to the first field and returns to the opener.
 * Closing plays the exit animation first, from the props of the last open render.
 */
export function FormSheet(props: FormSheetProps) {
  const last = useRef(props);
  if (props.open) last.current = props;
  const [shown, setShown] = useState(props.open);
  const [closing, setClosing] = useState(false);
  const wasShown = useRef(props.open);

  useEffect(() => {
    if (props.open) {
      wasShown.current = true;
      setShown(true);
      setClosing(false);
      return;
    }
    if (!wasShown.current) return;
    wasShown.current = false;
    setClosing(true);
    const t = setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [props.open]);

  if (!shown) return null;
  return <Panel {...(props.open ? props : last.current)} closing={closing} />;
}

function Panel({ title, icon, dest, formId, busy, saveLabel, onDelete, onClose, banners, children, closing }: FormSheetProps & { closing: boolean }) {
  const panel = useRef<HTMLElement>(null);
  // an inline onClose must not re-run the open effect (it would re-focus the first field and lose the opener)
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") return close.current();
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const lastEl = items[items.length - 1];
      if (!panel.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>(FIRST_FIELD)?.focus(), FOCUS_DELAY);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  // phone: dragging the grab handle down closes the sheet (pointer capture, so no document listeners)
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const move = (dy: number) => panel.current?.style.setProperty("--form-drag", `${dy}px`);
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, dy: 0 };
    panel.current?.setAttribute("data-dragging", "");
  };
  const dragMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    move(drag.current.dy);
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    panel.current?.removeAttribute("data-dragging");
    if (d && d.dy > DRAG_CLOSE) return close.current();
    move(0);
  };

  return (
    <>
      <button type="button" className="form-scrim" aria-label="Kapat" tabIndex={-1} data-closing={closing ? "" : undefined} onClick={onClose} />
      <section ref={panel} role="dialog" aria-modal="true" aria-label={title} className="form-sheet" data-closing={closing ? "" : undefined}>
        <button type="button" className="form-grab" aria-label="Kapatmak için aşağı sürükle" tabIndex={-1} onPointerDown={down} onPointerMove={dragMove} onPointerUp={up} onPointerCancel={up} />
        <header className="form-head">
          <span className="form-head-icon"><PathIcon d={icon} className="size-form-icon-19" /></span>
          <div className="form-head-text">
            <h2 className="form-title">{title}</h2>
            <span className="form-dest">{dest}</span>
          </div>
          <button type="button" className="form-close" aria-label="Kapat" onClick={onClose}>
            <PathIcon d={FORM_ICON.close} className="size-icon-chip" stroke={2} />
          </button>
        </header>
        <div className="form-body">
          {banners}
          {children}
        </div>
        <footer className="form-foot">
          {onDelete ? <button type="button" className="form-btn" data-kind="danger" onClick={onDelete}>Sil</button> : null}
          <span className="form-foot-gap" />
          <button type="button" className="form-btn" onClick={onClose}>Vazgeç</button>
          <button type="submit" form={formId} className="form-btn" data-kind="primary" disabled={busy} aria-busy={busy}>
            {busy ? <span className="ff-spinner" /> : null}
            {saveLabel}
          </button>
        </footer>
      </section>
    </>
  );
}
