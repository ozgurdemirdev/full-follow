import { useState } from "react";
import { run } from "../../api/actions";
import { K } from "../../api/keys";
import { useQuery } from "../../api/store";
import type { NetworkSettings, Today } from "../../api/types";
import { order } from "../../components/ui";
import { Head } from "./Head";
import { QuotaFields } from "./QuotaFields";

// Kaç gün cevapsız kalınca öne çıkar, kaç gün sessiz bağlantı soğumuş sayılır
export function NetworkCard() {
  const t = useQuery<Today>(K.today);
  const cfg = t.data?.network.settings;
  if (!cfg) return null;
  return <NetworkFields key={`${cfg.reply_wait_days}-${cfg.cooling_days}-${cfg.followup_days.join(",")}-${cfg.weekly_target}-${JSON.stringify(cfg.channel_limits)}-${cfg.email_warmup_until}`} cfg={cfg} />;
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
            <label htmlFor={`set-${f.key}`} className="lab" data-setting={f.label}>{f.label}</label>
            <input id={`set-${f.key}`} className="inp font-mono" inputMode="numeric" value={v[f.key]}
              onChange={(e) => setV((p) => ({ ...p, [f.key]: e.target.value }))}
              onBlur={() => save(f.key)} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
            <span className="text-sm text-text-muted">{f.hint}</span>
          </div>
        ))}
        <MarketingFields cfg={cfg} />
        <QuotaFields cfg={cfg} />
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
        <label htmlFor="set-followup" className="lab" data-setting="Takip dizisi (gün)">Takip dizisi (gün)</label>
        <input id="set-followup" className="inp font-mono" value={days} onChange={(e) => setDays(e.target.value)}
          onBlur={saveDays} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
        <span className="text-sm text-text-muted">Cevapsız mesajdan bu kadar gün sonra Claude takip taslağı hazırlar (örn. 3, 7). Boş bırakırsan kapanır.</span>
      </div>
      <div className="flex flex-col gap-3">
        <label htmlFor="set-target" className="lab" data-setting="Haftalık giden mesaj hedefi">Haftalık giden mesaj hedefi</label>
        <input id="set-target" className="inp font-mono" inputMode="numeric" value={target} placeholder="0 = hedef yok" onChange={(e) => setTarget(e.target.value)}
          onBlur={saveTarget} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
        <span className="text-sm text-text-muted">Dashboard’da bu haftanın ilerlemesi görünür</span>
      </div>
    </>
  );
}
