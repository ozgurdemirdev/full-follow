import { useEffect, useMemo, useState } from "react";
import { run } from "@kit/api/actions";
import { useQuery } from "@kit/api/store";
import type { Detail, FileRow, Offer, OfferItem, OfferPlanPart, Opportunity, PriceFloor } from "@kit/api/types";
import { linkTo } from "@kit/app/modules/links";
import { Form } from "@kit/components/forms/Form";
import { AreaField, ChipsField, DateField, NumField } from "@kit/components/forms/fields";
import { ComboField, ItemsField, itemsTotal, newItemRow, PlanField, planSum, type ItemRow, type PlanRow } from "@kit/components/forms/fields-rich";
import type { RemoteSource } from "@kit/components/Combo";
import { useRefText, type Ref } from "@kit/forms/helpers";
import { errorsOf, useSubmit, type FormProps } from "@kit/forms/shared";
import { todayIso } from "@kit/lib/format";
import { PROJECT_STAGE, STAGE } from "@kit/lib/labels";
import { useSettings } from "@kit/lib/settings";
import { m } from "../messages";
import { m as kit } from "@kit/messages";

const AMOUNT_STEP = 1000;
const PLAN_FULL = 100;
/** The plan part every offer plan needs (the server's deposit milestone) */
const DEPOSIT_KEY = "pesinat";
type Related = { offers?: Offer[]; files?: FileRow[] };

/** The payment template of the settings as plan rows: whole percents, the last part takes what the rounding leaves */
function planFromTemplate(template: PriceFloor["payment_template"] | undefined): PlanRow[] {
  const rows = (template ?? []).map((t) => ({ key: t.milestone, label: PROJECT_STAGE[t.milestone as keyof typeof PROJECT_STAGE] ?? t.milestone, pct: Math.round(t.percent) }));
  if (rows.length) rows[rows.length - 1].pct += PLAN_FULL - planSum(rows);
  return rows;
}

/** The opportunities an offer can be made for: the open ones, searched on the server */
const OPEN_OPPS: RemoteSource[] = [{
  path: "/opportunities",
  params: { open: true },
  toOption: (o: Opportunity) => ({ id: o.id, label: o.title, sub: `${o.company_name ?? o.person_name} · ${STAGE[o.stage]}` }),
}];

/**
 * Offer form of the sheet (new version or edit): the opportunity, lines with quantity and unit price (or a plain amount),
 * the payment plan (how the project's payments split once the opportunity is won; starts from the settings template),
 * date, note, and an optional offer file of the opportunity. The server keeps the quantity and computes each line amount.
 */
export function OfferForm(p: FormProps) {
  const pre = p.sheet.preset;
  const editId = pre?.edit;
  const [opp, setOpp] = useState<Ref>(() => ({ id: pre?.opportunity_id ?? null, text: "" }));
  // the text of an opportunity the form was opened for comes from its own read
  useRefText(opp, setOpp, "/opportunities");

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
      if (editId) await run("patch", `/offers/${editId}`, body, { ok: m.offerForm.updated, open });
      else await run("post", "/offers", { ...body, opportunity_id: opp.id }, { ok: m.offerForm.added, open });
    },
    () => errorsOf({
      opp: !opp.id && m.offerForm.pickOpp,
      amount: !(value > 0) && m.offerForm.amountRequired,
      plan: planRows.length > 0 && ((planSum(planRows) !== PLAN_FULL && m.offerForm.planTotal(PLAN_FULL)) || (!planRows.some((r) => r.key === DEPOSIT_KEY && r.pct > 0) && m.offerForm.planDeposit)),
    }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <ComboField name="opp" label={m.offerForm.opp} req value={opp} onChange={setOpp} remote={OPEN_OPPS} placeholder={m.offerForm.oppPlaceholder} />
      <ItemsField name="amount" label={m.offerForm.items} opt items={items} onChange={setItems} />
      {total === 0 ? <NumField label={m.offerForm.amount} hint={m.offerForm.amountHint} half prefix={kit.lira} step={AMOUNT_STEP} value={amount} onChange={setAmount} /> : null}
      {planRows.length ? <PlanField name="plan" label={m.offerForm.plan} req hint={m.offerForm.planHint} rows={planRows} total={value > 0 ? value : 0} onChange={setPlan} /> : null}
      <DateField label={m.offerForm.date} half value={date} onChange={setDate} placeholder={m.form.datePlaceholder} />
      <AreaField label={kit.nouns.note} opt value={note} onChange={setNote} placeholder={m.offerForm.notePlaceholder} rows={3} />
      {files.length ? (
        <ChipsField label={m.offerForm.file} opt clearable value={fileId} onChange={setFileId} options={files.map((f) => ({ value: String(f.id), label: f.name }))} />
      ) : null}
    </Form>
  );
}
