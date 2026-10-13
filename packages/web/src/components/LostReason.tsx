import { useEffect, useState } from "react";
import { Field, Sheet } from "./Sheet";

/** Asks why an opportunity was lost (the core requires a reason for kaybedildi) */
export function LostReason({ open, onCancel, onSave }: { open: boolean; onCancel: () => void; onSave: (r: string) => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [open]);
  return (
    <Sheet
      open={open}
      title="Neden kaybedildi?"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-sec btn-lg" onClick={onCancel}>Vazgeç</button>
          <button type="button" className="btn btn-pri btn-lg" disabled={!reason.trim()} onClick={() => onSave(reason.trim())}>Kaydet</button>
        </>
      }
    >
      <Field label="Neden" htmlFor="lost-reason">
        <textarea id="lost-reason" className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn. bütçe uymadı, başkasıyla anlaştı" />
      </Field>
    </Sheet>
  );
}
