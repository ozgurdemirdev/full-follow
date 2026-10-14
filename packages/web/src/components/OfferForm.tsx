import { useEffect, useMemo, useState } from "react";
import { run } from "../api/actions";
import { useOpps } from "../api/keys";
import { useQuery } from "../api/store";
import type { Detail, FileRow, Offer, OfferItem, Opportunity } from "../api/types";
import { recordPath } from "../app/routes";
import { Form } from "../components/forms/Form";
import { AreaField, ChipsField, DateField, NumField } from "../components/forms/fields";
import { ComboField, ItemsField, itemsTotal, newItemRow, type ItemRow } from "../components/forms/fields-rich";
import type { Ref } from "../forms/helpers";
import { errorsOf, useSubmit, type FormProps } from "../forms/shared";
import { todayIso } from "../lib/format";
import { STAGE } from "../lib/labels";

const AMOUNT_STEP = 1000;
type Related = { offers?: Offer[]; files?: FileRow[] };

/**
 * Offer form of the sheet (new version or edit): the opportunity, lines with quantity and unit price (or a plain amount),
 * date, note, and an optional offer file of the opportunity. The offer lines keep a label and a line amount; quantity only
 * multiplies the unit price on screen.
 */
export function OfferForm(p: FormProps) {
  const pre = p.sheet.preset;
  const editId = pre?.edit;
  const opps = useOpps();
  const [opp, setOpp] = useState<Ref>(() => ({ id: pre?.opportunity_id ?? null, text: "" }));
  const oppOptions = useMemo(
    () => opps.rows.filter((o) => !["kazanildi", "kaybedildi"].includes(o.stage) || o.id === opp.id).map((o) => ({ id: o.id, label: o.title, sub: `${o.company_name ?? o.person_name} · ${STAGE[o.stage]}` })),
    [opps.rows, opp.id],
  );
  useEffect(() => {
    if (opp.id && !opp.text) {
      const o = opps.byId.get(opp.id);
      if (o) setOpp({ id: o.id, text: o.title });
    }
  }, [opps.byId, opp]);

  const detail = useQuery<Detail<Opportunity, Related>>(opp.id ? `/opportunities/${opp.id}?with=offers,files` : null);
  const files = detail.data?.related.files ?? [];
  const offer = editId ? detail.data?.related.offers?.find((o) => o.id === editId) : undefined;

  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [fileId, setFileId] = useState("");
  useEffect(() => {
    if (!offer) return;
    setAmount(offer.amount);
    setDate(offer.offered_at);
    setNote(offer.note ?? "");
    setItems(offer.items.map((i) => newItemRow({ label: i.label, unit: i.amount })));
    setFileId(offer.file_id ? String(offer.file_id) : "");
  }, [offer]);

  const total = itemsTotal(items);
  const value = total > 0 ? total : Number(amount);

  const submit = useSubmit(
    p,
    async () => {
      const body = {
        amount: value, offered_at: date, note: note.trim() || null, file_id: fileId ? Number(fileId) : null,
        items: items.filter((i) => i.label.trim()).map((i): OfferItem => ({ label: i.label.trim(), amount: i.qty * (i.unit ?? 0) })),
      };
      const open = recordPath("opportunity", Number(opp.id)) ?? undefined;
      if (editId) await run("patch", `/offers/${editId}`, body, { ok: "Teklif güncellendi", open });
      else await run("post", "/offers", { ...body, opportunity_id: opp.id }, { ok: "Teklif eklendi", open });
    },
    () => errorsOf({ opp: !opp.id && "Fırsatı seç", amount: !(value > 0) && "Tutar ya da en az bir kalem gerekli" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <ComboField name="opp" label="Fırsat" req value={opp} onChange={setOpp} options={oppOptions} placeholder="Fırsat ara" />
      <ItemsField name="amount" label="Kalemler" opt items={items} onChange={setItems} />
      {total === 0 ? <NumField label="Tutar" hint="KDV hariç. Kalem eklersen toplam otomatik olur" half prefix="₺" step={AMOUNT_STEP} value={amount} onChange={setAmount} /> : null}
      <DateField label="Teklif tarihi" half value={date} onChange={setDate} placeholder="Örn. 12 Ekim" />
      <AreaField label="Not" opt value={note} onChange={setNote} placeholder="Örn. 3 sayfa, bakım dahil değil" rows={3} />
      {files.length ? (
        <ChipsField label="Teklif dosyası" opt clearable value={fileId} onChange={setFileId} options={files.map((f) => ({ value: String(f.id), label: f.name }))} />
      ) : null}
    </Form>
  );
}
