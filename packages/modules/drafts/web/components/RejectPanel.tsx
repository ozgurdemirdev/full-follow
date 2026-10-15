import { useState } from "react";
import { REJECT_FALLBACK, REJECT_REASONS } from "../drafts";
import { m } from "../messages";

/** "Neden?" panel: reason chips fill the text field, the field can be edited; Claude learns from the note */
export function RejectPanel({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <div className="drf-reject">
      <span className="text-base">{m.rejectPanel.why}</span>
      <div className="drf-chips">
        {REJECT_REASONS.map((r) => (
          <button key={r} type="button" className="drf-rchip" aria-pressed={note === r} onClick={() => setNote(r)}>{r}</button>
        ))}
      </div>
      <input className="drf-rinput" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder={m.rejectPanel.placeholder} aria-label={m.rejectPanel.label} />
      <div className="drf-reject-actions">
        <button type="button" className="drf-btn" onClick={onCancel}>{m.shared.cancel}</button>
        <button type="button" className="drf-btn is-danger" disabled={busy} onClick={() => onConfirm(note.trim() || REJECT_FALLBACK)}>{m.rejectPanel.confirm}</button>
      </div>
    </div>
  );
}
