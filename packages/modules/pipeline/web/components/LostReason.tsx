import { useEffect, useRef, useState } from "react";
import { m } from "../messages";
import { LOST_NO_REASON, LOST_PRESETS } from "../pipeline";

const FOCUSABLE = "button:not([tabindex='-1']), input";

/** Centered dialog: reason chips plus a free text; Esc, the backdrop and "Vazgeç" cancel, Tab stays inside, focus returns to the opener */
function Dialog({ name, onCancel, onSave }: { name?: string; onCancel: () => void; onSave: (r: string) => void }) {
  const [reason, setReason] = useState("");
  const panel = useRef<HTMLElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

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

  return (
    <>
      <button type="button" className="pipe-scrim" aria-label={m.shared.cancel} tabIndex={-1} onClick={onCancel} />
      <section ref={panel} className="pipe-dlg" role="dialog" aria-modal="true" aria-label={m.lost.title}>
        <div className="flex flex-col gap-1">
          <h2 className="pipe-dlg-title">{m.lost.title}</h2>
          <span className="text-base-sm text-text-secondary">{m.lost.sub(name)}</span>
        </div>
        <div className="pipe-chips">
          {LOST_PRESETS.map((r) => (
            <button key={r} type="button" className="pipe-chip" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
        <input type="text" className="pipe-input" value={reason} aria-label={m.lost.reasonLabel} placeholder={m.lost.placeholder}
          onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSave(reason.trim() || LOST_NO_REASON)} />
        <div className="pipe-dlg-foot">
          <button type="button" className="pipe-dlg-btn" onClick={onCancel}>{m.shared.cancel}</button>
          <button type="button" className="pipe-dlg-btn is-primary" onClick={() => onSave(reason.trim() || LOST_NO_REASON)}>{m.shared.save}</button>
        </div>
      </section>
    </>
  );
}

/** Asks why an opportunity was lost (the core requires a reason for kaybedildi) */
export function LostReason({ open, name, onCancel, onSave }: { open: boolean; name?: string; onCancel: () => void; onSave: (r: string) => void }) {
  return open ? <Dialog name={name} onCancel={onCancel} onSave={onSave} /> : null;
}
