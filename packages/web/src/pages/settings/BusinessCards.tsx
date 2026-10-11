import { useState } from "react";
import { run } from "../../api/actions";
import { K } from "../../api/keys";
import { useQuery } from "../../api/store";
import type { PriceFloor } from "../../api/types";
import { Chip, ErrorBox, order, Skeleton } from "../../components/ui";
import { tl } from "../../lib/format";
import { MILESTONE } from "../../lib/labels";
import { Head } from "./Head";

type NumKey = "bagkur_monthly" | "accounting_monthly" | "other_fixed_monthly" | "target_net_monthly" | "tax_rate_percent";
const FIELDS: { key: NumKey; label: string; hint?: string }[] = [
  { key: "bagkur_monthly", label: "Bağkur (aylık)" },
  { key: "accounting_monthly", label: "Muhasebe (aylık)" },
  { key: "other_fixed_monthly", label: "Diğer sabit giderler (aylık)", hint: "Sunucu, yazılım, internet" },
  { key: "target_net_monthly", label: "Hedeflenen net gelir (aylık)" },
  { key: "tax_rate_percent", label: "Vergi oranı (%)" },
];

/** Both business cards read the same settings entry (one request); `mount` is the card, given the loaded settings */
function WithSettings({ mount }: { mount: (s: PriceFloor) => React.ReactNode }) {
  const s = useQuery<PriceFloor>(K.settings);
  if (s.error && !s.data) return <ErrorBox error={s.error} retry={s.reload} />;
  if (!s.data) return <Skeleton className="h-chart-height" />;
  return <>{mount(s.data)}</>;
}

export const FloorCard = () => <WithSettings mount={(s) => <FloorCardView key={`f${s.floor}`} s={s} />} />;
export const TemplateCard = () => <WithSettings mount={(s) => <TemplateCardView key={`t${JSON.stringify(s.payment_template)}`} s={s} />} />;

function FloorCardView({ s }: { s: PriceFloor }) {
  const [v, setV] = useState<Record<NumKey, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, String(s[f.key])])) as Record<NumKey, string>);
  const n = (k: NumKey) => Number(v[k].replace(",", ".")) || 0;
  const subtotal = n("bagkur_monthly") + n("accounting_monthly") + n("other_fixed_monthly") + n("target_net_monthly");
  const tax = Math.min(99, n("tax_rate_percent"));
  const floor = Math.ceil(subtotal / (1 - tax / 100));
  const dirty = FIELDS.some((f) => n(f.key) !== s[f.key]);

  const save = (k: NumKey) => {
    if (n(k) === s[k]) return;
    void run("put", "/settings", { [k]: n(k) }, { ok: "Kaydedildi" }).catch(() => setV((p) => ({ ...p, [k]: String(s[k]) })));
  };

  return (
    <section className="card rise flex flex-col gap-7 px-9 py-8" style={order(0)} aria-label="Fiyat tabanı">
      <Head title="Fiyat tabanı">{dirty ? <Chip tone="payment">Kaydediliyor</Chip> : null}</Head>
      <div className="grid grid-cols-1 gap-6 desk:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-3">
            <label htmlFor={`set-${f.key}`} className="lab" data-setting={f.label}>{f.label}</label>
            <input id={`set-${f.key}`} className="inp font-mono" inputMode="decimal" value={v[f.key]}
              onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))}
              onBlur={() => save(f.key)} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
            {f.hint ? <span className="text-sm text-text-muted">{f.hint}</span> : null}
          </div>
        ))}
      </div>
      <div className="inset flex flex-col gap-2 px-7 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-base-sm text-text-secondary">Aylık taban</span>
          <span className="kpi">{tl(floor)}</span>
        </div>
        <span className="text-sm text-text-muted">(Bağkur + muhasebe + diğer + hedef net) / (1 − vergi) = {tl(subtotal)} / {(1 - tax / 100).toFixed(2)}</span>
      </div>
    </section>
  );
}

function TemplateCardView({ s }: { s: PriceFloor }) {
  const [rows, setRows] = useState(s.payment_template.map((r) => ({ ...r })));
  const [busy, setBusy] = useState(false);
  const sum = rows.reduce((a, r) => a + (Number(r.percent) || 0), 0);
  const dirty = JSON.stringify(rows) !== JSON.stringify(s.payment_template);
  const used = new Set(rows.map((r) => r.milestone));
  const free = Object.keys(MILESTONE).filter((m) => !used.has(m));
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((p) => p.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true);
    try {
      await run("put", "/settings", { payment_template: rows }, { ok: "Ödeme şablonu kaydedildi" });
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card rise flex flex-col gap-6 px-9 py-8" style={order(1)} aria-label="Ödeme şablonu">
      <Head title="Ödeme şablonu">
        <Chip tone={sum === 100 ? "success" : "payment"}>Toplam %{sum}</Chip>
      </Head>
      <p className="m-0 text-base-sm text-text-secondary">Kazanılan fırsat projeye dönünce ödemeler bu şablona göre açılır. Gün, proje başlangıcından sonraki vade.</p>
      <div className="flex flex-col gap-3">
        {rows.map((r, i) => (
          <div key={r.milestone} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3">
            <span className="truncate text-base" data-setting={MILESTONE[r.milestone] ?? r.milestone}>{MILESTONE[r.milestone] ?? r.milestone}</span>
            <label className="flex items-center gap-2 text-sm text-text-secondary">%
              <input className="inp inp-num w-input-num-sm flex-none" inputMode="numeric" aria-label={`${MILESTONE[r.milestone]} yüzde`} value={r.percent}
                onChange={(e) => set(i, { percent: Number(e.target.value) || 0 })} />
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input className="inp inp-num w-input-num-sm flex-none" inputMode="numeric" aria-label={`${MILESTONE[r.milestone]} gün`} value={r.days}
                onChange={(e) => set(i, { days: Number(e.target.value) || 0 })} />gün
            </label>
            <button type="button" className="ibtn" aria-label="Satırı sil" disabled={rows.length < 2} onClick={() => setRows((p) => p.filter((_, k) => k !== i))}>×</button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {free.length ? (
          <select className="inp w-auto" aria-label="Aşama ekle" value="" onChange={(e) => e.target.value && setRows((p) => [...p, { milestone: e.target.value, percent: 0, days: 0 }])}>
            <option value="">Aşama ekle</option>
            {free.map((m) => <option key={m} value={m}>{MILESTONE[m]}</option>)}
          </select>
        ) : null}
        <span className="flex-grow" />
        {dirty ? <button type="button" className="btn btn-sec" onClick={() => setRows(s.payment_template.map((r) => ({ ...r })))}>Geri al</button> : null}
        <button type="button" className="btn btn-pri" disabled={busy || !dirty || sum !== 100} onClick={save}>Kaydet</button>
      </div>
    </section>
  );
}
