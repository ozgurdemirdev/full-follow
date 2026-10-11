import { useState, type ReactNode } from "react";
import { api } from "../api/client";
import { run } from "../api/actions";
import { K } from "../api/keys";
import { useQuery } from "../api/store";
import type { NetworkSettings, PriceFloor, Today } from "../api/types";
import { Page } from "../app/Page";
import { Chip, ErrorBox, order, PageSkeleton } from "../components/ui";
import { tl } from "../lib/format";
import { MILESTONE } from "../lib/labels";
import { SectorsCard, SourcesCard, TagsCard, TrashCard } from "./SettingsLists";

type NumKey = "bagkur_monthly" | "accounting_monthly" | "other_fixed_monthly" | "target_net_monthly" | "tax_rate_percent";
const FIELDS: { key: NumKey; label: string; hint?: string }[] = [
  { key: "bagkur_monthly", label: "Bağkur (aylık)" },
  { key: "accounting_monthly", label: "Muhasebe (aylık)" },
  { key: "other_fixed_monthly", label: "Diğer sabit giderler (aylık)", hint: "Sunucu, yazılım, internet" },
  { key: "target_net_monthly", label: "Hedeflenen net gelir (aylık)" },
  { key: "tax_rate_percent", label: "Vergi oranı (%)" },
];

export default function Settings() {
  const s = useQuery<PriceFloor>(K.settings);
  return (
    <Page title="Ayarlar" sub="Network süreleri, fiyat tabanı, etiketler, sektörler, kaynaklar ve çöp kutusu" width="narrow" className="flex flex-col gap-7">
      <NetworkCard />
      {s.error && !s.data ? <ErrorBox error={s.error} retry={s.reload} /> : null}
      {!s.data ? (
        !s.error && <PageSkeleton />
      ) : (
        <>
          <FloorCard key={`f${s.data.floor}`} s={s.data} />
          <TemplateCard key={`t${JSON.stringify(s.data.payment_template)}`} s={s.data} />
        </>
      )}
      {s.data && <ChatNotesCard key={`c${s.data.chat_pinned_notes}`} notes={s.data.chat_pinned_notes} />}
      <TagsCard />
      <SectorsCard />
      <SourcesCard />
      <TrashCard />
      <ClaudeCard />
      <SessionCard />
    </Page>
  );
}

function FloorCard({ s }: { s: PriceFloor }) {
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
            <label htmlFor={`set-${f.key}`} className="lab">{f.label}</label>
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

function TemplateCard({ s }: { s: PriceFloor }) {
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
            <span className="truncate text-base">{MILESTONE[r.milestone] ?? r.milestone}</span>
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

// Kaç gün cevapsız kalınca öne çıkar, kaç gün sessiz bağlantı soğumuş sayılır
function NetworkCard() {
  const t = useQuery<Today>(K.today);
  const cfg = t.data?.network.settings;
  if (!cfg) return null;
  return <NetworkFields key={`${cfg.reply_wait_days}-${cfg.cooling_days}-${cfg.followup_days.join(",")}-${cfg.weekly_target}`} cfg={cfg} />;
}

function NetworkFields({ cfg }: { cfg: NetworkSettings }) {
  const [v, setV] = useState({ reply_wait_days: String(cfg.reply_wait_days), cooling_days: String(cfg.cooling_days) });
  const items = [
    { key: "reply_wait_days" as const, label: "Cevap bekleme süresi (gün)", hint: "Bu kadar gün cevap gelmezse kişi Dashboard’da öne çıkar" },
    { key: "cooling_days" as const, label: "Soğuma süresi (gün)", hint: "Bağlantıyla bu kadar gün temas yoksa “soğuyor” sayılır" },
  ];
  const save = (k: keyof typeof v) => {
    const n = Math.max(1, Math.round(Number(v[k]) || 0));
    if (n === cfg[k]) return setV((p) => ({ ...p, [k]: String(cfg[k]) }));
    void run("put", "/settings", { [k]: n }, { ok: "Kaydedildi" }).catch(() => setV((p) => ({ ...p, [k]: String(cfg[k]) })));
  };
  return (
    <section className="card rise flex flex-col gap-7 px-9 py-8" style={order(0)} aria-label="Network">
      <Head title="Network" />
      <div className="grid grid-cols-1 gap-6 desk:grid-cols-2">
        {items.map((f) => (
          <div key={f.key} className="flex flex-col gap-3">
            <label htmlFor={`set-${f.key}`} className="lab">{f.label}</label>
            <input id={`set-${f.key}`} className="inp font-mono" inputMode="numeric" value={v[f.key]}
              onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))}
              onBlur={() => save(f.key)} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
            <span className="text-sm text-text-muted">{f.hint}</span>
          </div>
        ))}
        <MarketingFields cfg={cfg} />
      </div>
    </section>
  );
}

// Takip dizisi günleri ve haftalık giden mesaj hedefi (Paket 2)
function MarketingFields({ cfg }: { cfg: NetworkSettings }) {
  const [days, setDays] = useState(cfg.followup_days.join(", "));
  const [target, setTarget] = useState(String(cfg.weekly_target || ""));
  const saveDays = () => {
    const list = days.split(/[,\s]+/).filter(Boolean).map(Number);
    if (list.join(",") === cfg.followup_days.join(",")) return setDays(cfg.followup_days.join(", "));
    void run("put", "/settings", { followup_days: list }, { ok: list.length ? "Takip günleri kaydedildi" : "Otomatik takip kapatıldı" })
      .catch(() => setDays(cfg.followup_days.join(", ")));
  };
  const saveTarget = () => {
    const n = Math.max(0, Math.round(Number(target) || 0));
    if (n === cfg.weekly_target) return;
    void run("put", "/settings", { weekly_target: n }, { ok: "Kaydedildi" }).catch(() => setTarget(String(cfg.weekly_target || "")));
  };
  return (
    <>
      <div className="flex flex-col gap-3">
        <label htmlFor="set-followup" className="lab">Takip dizisi (gün)</label>
        <input id="set-followup" className="inp font-mono" value={days} onChange={(e) => setDays(e.target.value)}
          onBlur={saveDays} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
        <span className="text-sm text-text-muted">Cevapsız mesajdan bu kadar gün sonra Claude takip taslağı hazırlar (örn. 3, 7). Boş bırakırsan kapanır.</span>
      </div>
      <div className="flex flex-col gap-3">
        <label htmlFor="set-target" className="lab">Haftalık giden mesaj hedefi</label>
        <input id="set-target" className="inp font-mono" inputMode="numeric" value={target} placeholder="0 = hedef yok" onChange={(e) => setTarget(e.target.value)}
          onBlur={saveTarget} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
        <span className="text-sm text-text-muted">Dashboard’da bu haftanın ilerlemesi görünür</span>
      </div>
    </>
  );
}

const PINNED_MAX = 4_000;

/** Text added to every panel chat (rules, business context); the next message of each chat picks it up */
function ChatNotesCard({ notes }: { notes: string }) {
  const [v, setV] = useState(notes);
  const save = () => {
    if (v.trim() === notes) return setV(notes);
    void run("put", "/settings", { chat_pinned_notes: v }, { ok: "Kaydedildi" }).catch(() => setV(notes));
  };
  return (
    <section className="card rise flex flex-col gap-4 px-9 py-8" style={order(2)} aria-label="Sohbet sabit notları">
      <Head title="Sohbet sabit notları" />
      <p className="m-0 text-base-sm text-text-secondary">Panel sohbetindeki Claude her konuşmada bu notu da görür. Yeni açılan sohbetlerde geçerli olur; eski sohbetler ilk açıldıkları notla devam eder.</p>
      <textarea id="set-chat-notes" className="inp min-h-textarea-lg" maxLength={PINNED_MAX} value={v} onChange={(e) => setV(e.target.value)} onBlur={save} aria-label="Sohbet sabit notları" />
      <span className="text-xs text-text-muted">{v.length.toLocaleString("tr-TR")} / {PINNED_MAX.toLocaleString("tr-TR")}</span>
    </section>
  );
}

function ClaudeCard() {
  return (
    <section className="card rise flex flex-col gap-4 px-9 py-8" style={order(3)} aria-label="Claude bağlantısı">
      <Head title="Claude bağlantısı" />
      <p className="m-0 text-base-sm text-text-secondary">
        Claude bu sisteme yerel MCP sunucusu üzerinden bağlanır, aynı çekirdeği kullanır. Claude’un yazdığı her kayıt “Claude” etiketiyle görünür; taslakları yalnız sen onaylarsın.
      </p>
      <code className="inset px-6 py-5 font-mono text-sm">npm run mcp</code>
    </section>
  );
}

function SessionCard() {
  const me = useQuery<{ auth: boolean; loggedIn: boolean }>("/me");
  if (!me.data?.auth) return null;
  const out = async () => {
    try {
      await api.post("/logout", {});
    } finally {
      location.reload();
    }
  };
  return (
    <section className="card rise flex items-center gap-5 px-9 py-7" style={order(4)} aria-label="Oturum">
      <span className="flex-grow text-base">Oturum açık</span>
      <button type="button" className="btn btn-sec" onClick={out}>Çıkış yap</button>
    </section>
  );
}

function Head({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="card-title flex-grow">{title}</h2>
      {children}
    </div>
  );
}
