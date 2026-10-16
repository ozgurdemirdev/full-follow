import { useState } from "react";
import { m } from "../messages";
import { LOST_NO_REASON, LOST_PRESETS } from "../pipeline";
import { Dialog } from "@kit/components/Dialog";
import { m as kit } from "@kit/messages";

/** Reason chips plus a free text in the app's dialog; Esc, the backdrop and "Vazgeç" cancel */
function Reason({ name, onCancel, onSave }: { name?: string; onCancel: () => void; onSave: (r: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog label={m.lost.title} onCancel={onCancel}>
      <div className="flex flex-col gap-1">
        <h2 className="dlg-title">{m.lost.title}</h2>
        <span className="text-base-sm text-text-secondary">{m.lost.sub(name)}</span>
      </div>
      <div className="pipe-chips">
        {LOST_PRESETS.map((r) => (
          <button key={r} type="button" className="pipe-chip" aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>
        ))}
      </div>
      <input type="text" className="pipe-input" value={reason} aria-label={m.lost.reasonLabel} placeholder={m.lost.placeholder}
        onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSave(reason.trim() || LOST_NO_REASON)} />
      <div className="dlg-foot">
        <button type="button" className="dlg-btn" onClick={onCancel}>{kit.cancel}</button>
        <button type="button" className="dlg-btn is-primary" onClick={() => onSave(reason.trim() || LOST_NO_REASON)}>{kit.save}</button>
      </div>
    </Dialog>
  );
}

/** Asks why an opportunity was lost (the core requires a reason for kaybedildi) */
export function LostReason({ open, name, onCancel, onSave }: { open: boolean; name?: string; onCancel: () => void; onSave: (r: string) => void }) {
  return open ? <Reason name={name} onCancel={onCancel} onSave={onSave} /> : null;
}
