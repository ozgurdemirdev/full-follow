import { useState } from "react";
import { run } from "../../api/actions";
import type { NetworkSettings } from "../../api/types";
import { QUOTA_CHANNELS } from "../../lib/labels";
import { channelName } from "../../lib/network";

/** Daily outgoing message limit per channel and the end date of the email warmup (cold email is off until then) */
export function QuotaFields({ cfg }: { cfg: NetworkSettings }) {
  const fromCfg = () => Object.fromEntries(QUOTA_CHANNELS.map((c) => [c, String(cfg.channel_limits[c] || "")]));
  const [limits, setLimits] = useState(fromCfg);
  const saveLimit = (channel: string) => {
    const n = Math.max(0, Math.round(Number(limits[channel]) || 0));
    if (n === (cfg.channel_limits[channel] ?? 0)) return setLimits(fromCfg);
    void run("put", "/settings", { channel_limits: { ...cfg.channel_limits, [channel]: n } }, { ok: "Kaydedildi" }).catch(() => setLimits(fromCfg));
  };
  const [warmup, setWarmup] = useState(cfg.email_warmup_until);
  const saveWarmup = (value: string) => {
    setWarmup(value);
    void run("put", "/settings", { email_warmup_until: value }, { ok: value ? "Isınma tarihi kaydedildi" : "Isınma dönemi kapatıldı" }).catch(() => setWarmup(cfg.email_warmup_until));
  };
  return (
    <>
      <div className="flex flex-col gap-3">
        <span className="lab" data-setting="Günlük gönderim limiti">Günlük gönderim limiti</span>
        <div className="grid grid-cols-2 gap-4">
          {QUOTA_CHANNELS.map((c) => (
            <label key={c} className="flex flex-col gap-2 text-sm text-text-secondary">
              {channelName(c)}
              <input className="inp font-mono" inputMode="numeric" value={limits[c]} placeholder="limit yok" aria-label={`${channelName(c)} günlük limit`}
                onChange={(e) => setLimits((p) => ({ ...p, [c]: e.target.value }))}
                onBlur={() => saveLimit(c)} onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()} />
            </label>
          ))}
        </div>
        <span className="text-sm text-text-muted">Dashboard’da bugün gönderilen sayı limitle karşılaştırılır; yaklaşınca ve dolunca uyarı çıkar. Boş ya da 0 = limit yok.</span>
      </div>
      <div className="flex flex-col gap-3">
        <label htmlFor="set-warmup" className="lab" data-setting="Soğuk e-posta ısınma bitişi">Soğuk e-posta ısınma bitişi</label>
        <input id="set-warmup" className="inp font-mono" type="date" value={warmup} onChange={(e) => saveWarmup(e.target.value)} />
        <span className="text-sm text-text-muted">Yeni alan adında ilk 2 hafta soğuk e-posta kapalı: bu tarihe kadar daha önce yazılmamış birine e-posta gidince uyarı çıkar. Boş = ısınma yok.</span>
      </div>
    </>
  );
}
