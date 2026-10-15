import { useState } from "react";
import { Link } from "wouter";
import { run } from "@kit/api/actions";
import type { Detail, Payment, Project } from "@kit/api/types";
import { NumberField } from "@kit/components/NumberField";
import { Chip, Who } from "@kit/components/ui";
import { fmtDay, tl } from "@kit/lib/format";
import { useRecordHref } from "@kit/lib/useRecordHref";
import { MILESTONE, PROJECT_STAGE, PROJECT_STEPS, type ProjectStage, type Tone } from "@kit/lib/labels";

function PaymentRow({ p }: { p: Payment }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const remaining = p.expected_amount - p.paid_amount;
  const pay = async () => {
    await run("post", `/payments/${p.id}/pay`, { amount: amount ?? remaining }, { ok: "Ödeme kaydedildi" });
    setOpen(false);
    setAmount(null);
  };
  const tone: Tone = p.status === "odendi" ? "success" : p.status === "gecikmis" ? "warning" : "payment";
  const st = { odendi: "Ödendi", kismi: "Kısmi", bekliyor: "Bekliyor", gecikmis: "Gecikti" }[p.status];
  return (
    <div className="inset flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-grow text-base">{MILESTONE[p.milestone]}</span>
        <Who actor={p.created_by} />
        <Chip tone={tone}>{st}</Chip>
      </div>
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <span className="font-mono">{tl(p.paid_amount)} / {tl(p.expected_amount)}</span>
        <span className="flex-grow" />
        {p.due_date ? <span>{fmtDay(p.due_date)}</span> : null}
        {remaining > 0 && !open ? <button type="button" className="btn btn-sec btn-sm" onClick={() => setOpen(true)}>Ödeme gir</button> : null}
      </div>
      {open ? (
        <div className="flex gap-3">
          <NumberField className="inp inp-num h-control-height-md" min={1} max={remaining} placeholder={remaining.toLocaleString("tr-TR")} value={amount} onChange={setAmount} onKeyDown={(e) => e.key === "Enter" && pay()} ariaLabel="Tutar" autoFocus />
          <button type="button" className="btn btn-pri" onClick={pay}>Kaydet</button>
        </div>
      ) : null}
    </div>
  );
}

/** The project's stage steps and its payments beside the timeline of a focused project (the `timeline.aside` slot) */
export default function TimelineProject({ type, detail }: { type: string; detail: Detail<any> }) {
  const [busy, setBusy] = useState(false);
  const recordHref = useRecordHref();
  if (type !== "project") return null;
  const p = detail.row as Project;
  const payments = (detail.related.payments as Payment[]) ?? [];
  const idx = PROJECT_STEPS.indexOf(p.stage);
  const move = async (stage: ProjectStage) => {
    setBusy(true);
    try {
      await run("post", `/projects/${p.id}/move`, { stage }, { ok: `Aşama: ${PROJECT_STAGE[stage]}` });
    } finally {
      setBusy(false);
    }
  };
  const next = idx >= 0 && idx < PROJECT_STEPS.length - 1 ? PROJECT_STEPS[idx + 1] : null;
  return (
    <>
      <section className="card rise flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-0.5">
          <span className="text-md font-semibold">{p.name}</span>
          <Link href={recordHref("person", p.person_id)} className="text-base-sm">{p.person_name}</Link>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-base-sm text-text-secondary">Aşama</span>
          <span className="text-base font-medium text-accent-text-soft">{PROJECT_STAGE[p.stage]}</span>
          <span className="flex-grow" />
          <span className="font-mono text-base-sm">{tl(p.price)}</span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {PROJECT_STEPS.map((s, k) => (
            <button key={s} type="button" title={PROJECT_STAGE[s]} aria-label={PROJECT_STAGE[s]} disabled={busy || k === idx} onClick={() => move(s)}
              className={`h-bar rounded-pill border-0 p-0 ${k < idx ? "bg-accent" : k === idx ? "step-now" : "bg-surface-track"}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {next ? <button type="button" className="btn btn-pri" disabled={busy} onClick={() => move(next)}>{PROJECT_STAGE[next]} aşamasına geç</button> : null}
          {p.stage !== "iptal" ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => confirm("Proje iptal edilsin mi?") && move("iptal")}>İptal et</button> : null}
        </div>
      </section>
      <section className="card rise flex flex-col gap-3 p-8">
        <h2 className="m-0 text-base font-semibold">Ödemeler</h2>
        {payments.length === 0 ? <p className="m-0 text-base-sm text-text-secondary">Ödeme planı yok. Fiyat girilince plan oluşur.</p> : null}
        {payments.map((x) => <PaymentRow key={x.id} p={x} />)}
      </section>
    </>
  );
}
