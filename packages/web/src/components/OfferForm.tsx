import { useState } from "react";
import { run } from "../api/actions";
import type { FileRow, Offer, OfferItem } from "../api/types";
import { todayIso } from "../lib/format";
import { Field } from "./Sheet";

/** Offer form (new version or edit): amount, date, price breakdown, note, and an optional offer file of the opportunity */
export function OfferForm({ opportunityId, offer, files, onDone }: { opportunityId: number; offer?: Offer; files: FileRow[]; onDone: () => void }) {
  const [amount, setAmount] = useState(offer ? String(offer.amount) : "");
  const [date, setDate] = useState(offer?.offered_at ?? todayIso());
  const [note, setNote] = useState(offer?.note ?? "");
  const [items, setItems] = useState<{ label: string; amount: string }[]>((offer?.items ?? []).map((i) => ({ label: i.label, amount: String(i.amount) })));
  const [fileId, setFileId] = useState(offer?.file_id ? String(offer.file_id) : "");
  const [busy, setBusy] = useState(false);
  const setItem = (i: number, patch: Partial<{ label: string; amount: string }>) => setItems((list) => list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const save = async () => {
    const body = {
      amount: Number(amount), offered_at: date, note: note.trim() || null, file_id: fileId ? Number(fileId) : null,
      items: items.filter((i) => i.label.trim()).map((i): OfferItem => ({ label: i.label.trim(), amount: Number(i.amount) || 0 })),
    };
    setBusy(true);
    try {
      if (offer) await run("patch", `/offers/${offer.id}`, body, { ok: "Teklif güncellendi" });
      else await run("post", "/offers", { ...body, opportunity_id: opportunityId }, { ok: "Teklif eklendi" });
      onDone();
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="inset flex flex-col gap-5 p-5">
      <div className="grid grid-cols-1 gap-4 desk:grid-cols-2">
        <Field label="Tutar (₺, KDV hariç)" htmlFor="of-amount">
          <input id="of-amount" className="inp inp-num" type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Teklif tarihi" htmlFor="of-date">
          <input id="of-date" className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Kalemler (isteğe bağlı)">
        <div className="flex flex-col gap-3">
          {items.map((it, i) => (
            <div key={i} className="flex gap-3">
              <input className="inp min-w-0 flex-1" placeholder="Kalem (ör. Tasarım)" aria-label="Kalem adı" value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
              <input className="inp inp-num w-amount-field" type="number" inputMode="numeric" min={0} placeholder="₺" aria-label="Kalem tutarı" value={it.amount} onChange={(e) => setItem(i, { amount: e.target.value })} />
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Kalemi kaldır" onClick={() => setItems((l) => l.filter((_, k) => k !== i))}>Kaldır</button>
            </div>
          ))}
          <button type="button" className="btn btn-sec btn-sm self-start" onClick={() => setItems((l) => [...l, { label: "", amount: "" }])}>Kalem ekle</button>
        </div>
      </Field>
      <Field label="Not" htmlFor="of-note">
        <textarea id="of-note" className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. 3 sayfa, bakım dahil değil" />
      </Field>
      {files.length ? (
        <Field label="Teklif dosyası" htmlFor="of-file">
          <select id="of-file" className="inp" value={fileId} onChange={(e) => setFileId(e.target.value)}>
            <option value="">Yok</option>
            {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
      ) : null}
      <div className="flex gap-3">
        <button type="button" className="btn btn-pri" disabled={busy || !(Number(amount) > 0)} onClick={() => void save()}>{offer ? "Kaydet" : "Teklifi ekle"}</button>
        <button type="button" className="btn btn-sec" onClick={onDone}>Vazgeç</button>
      </div>
    </div>
  );
}
