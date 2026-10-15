import { useEffect, useMemo, useState } from "react";
import { run } from "@kit/api/actions";
import { useOpps } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Detail, FileRow, Offer, OfferItem, OfferPlanPart, Opportunity, PriceFloor } from "@kit/api/types";
import { linkTo } from "@kit/app/modules/links";
import { Form } from "@kit/components/forms/Form";
import { AreaField, ChipsField, DateField, NumField } from "@kit/components/forms/fields";
import { ComboField, ItemsField, itemsTotal, newItemRow, PlanField, planSum, type ItemRow, type PlanRow } from "@kit/components/forms/fields-rich";
import type { Ref } from "@kit/forms/helpers";
import { errorsOf, useSubmit, type FormProps } from "@kit/forms/shared";
import { todayIso } from "@kit/lib/format";
import { PROJECT_STAGE, STAGE } from "@kit/lib/labels";
import { useSettings } from "@kit/lib/settings";

const AMOUNT_STEP = 1000;
const PLAN_FULL = 100;
type Related = { offers?: Offer[]; files?: FileRow[] };

/** The payment template of the settings as plan rows: whole percents, the last part takes what the rounding leaves */
function planFromTemplate(template: PriceFloor["payment_template"] | undefined): PlanRow[] {
  const rows = (template ?? []).map((t) => ({ key: t.milestone, label: PROJECT_STAGE[t.milestone as keyof typeof PROJECT_STAGE] ?? t.milestone, pct: Math.round(t.percent) }));
  if (rows.length) rows[rows.length - 1].pct += PLAN_FULL - planSum(rows);
  return rows;
}

/**
 * Offer form of the sheet (new version or edit): the opportunity, lines with quantity and unit price (or a plain amount),
 * the payment plan (how the project's payments split once the opportunity is won; starts from the settings template),
 * date, note, and an optional offer file of the opportunity. The server keeps the quantity and computes each line amount.
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
  // null = untouched: the plan is the settings template
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const template = useSettings().data?.payment_template;
  const planRows = useMemo(() => plan ?? planFromTemplate(template), [plan, template]);
  const [fileId, setFileId] = useState("");
  useEffect(() => {
    if (!offer) return;
    setAmount(offer.amount);
    setDate(offer.offered_at);
    setNote(offer.note ?? "");
    setItems(offer.items.map((i) => newItemRow({ label: i.label, qty: i.qty, unit: i.amount })));
    setPlan(offer.plan?.map((p) => ({ key: p.key, label: p.label, pct: p.pct })) ?? null);
    setFileId(offer.file_id ? String(offer.file_id) : "");
  }, [offer]);

  const total = itemsTotal(items);
  const value = total > 0 ? total : Number(amount);

  const submit = useSubmit(
    p,
    async () => {
      const body = {
        amount: value, offered_at: date, note: note.trim() || null, file_id: fileId ? Number(fileId) : null,
        items: items.filter((i) => i.label.trim()).map((i): Pick<OfferItem, "label" | "amount" | "qty"> => ({ label: i.label.trim(), amount: i.unit ?? 0, qty: i.qty })),
        plan: planRows.length ? planRows.filter((r) => r.pct > 0).map((r): OfferPlanPart => ({ key: r.key as OfferPlanPart["key"], label: r.label, pct: r.pct })) : undefined,
      };
      const open = linkTo("opportunity", Number(opp.id)) ?? undefined;
      if (editId) await run("patch", `/offers/${editId}`, body, { ok: "Teklif güncellendi", open });
      else await run("post", "/offers", { ...body, opportunity_id: opp.id }, { ok: "Teklif eklendi", open });
    },
    () => errorsOf({
      opp: !opp.id && "Fırsatı seç",
      amount: !(value > 0) && "Tutar ya da en az bir kalem gerekli",
      plan: planRows.length > 0 && planSum(planRows) !== PLAN_FULL && `Yüzdelerin toplamı ${PLAN_FULL} olmalı`,
    }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <ComboField name="opp" label="Fırsat" req value={opp} onChange={setOpp} options={oppOptions} placeholder="Fırsat ara" />
      <ItemsField name="amount" label="Kalemler" opt items={items} onChange={setItems} />
      {total === 0 ? <NumField label="Tutar" hint="KDV hariç. Kalem eklersen toplam otomatik olur" half prefix="₺" step={AMOUNT_STEP} value={amount} onChange={setAmount} /> : null}
      {planRows.length ? <PlanField name="plan" label="Ödeme planı" req hint="Kazanılınca projenin ödemeleri bu orana göre açılır" rows={planRows} total={value > 0 ? value : 0} onChange={setPlan} /> : null}
      <DateField label="Teklif tarihi" half value={date} onChange={setDate} placeholder="Örn. 12 Ekim" />
      <AreaField label="Not" opt value={note} onChange={setNote} placeholder="Örn. 3 sayfa, bakım dahil değil" rows={3} />
      {files.length ? (
        <ChipsField label="Teklif dosyası" opt clearable value={fileId} onChange={setFileId} options={files.map((f) => ({ value: String(f.id), label: f.name }))} />
      ) : null}
    </Form>
  );
}
