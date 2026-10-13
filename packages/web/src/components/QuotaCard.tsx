import type { Quota, QuotaState } from "../api/types";
import { fmtDay } from "../lib/format";
import { channelName } from "../lib/network";
import { CardHead, order } from "./ui";

/** Bar and count colour per state: muted while fine, warning when close, danger when the limit is reached or passed */
const TONE: Record<QuotaState, { bar: string; text: string }> = {
  ok: { bar: "bg-accent-neutral", text: "text-text-secondary" },
  near: { bar: "bg-status-text-attention", text: "text-status-text-attention" },
  over: { bar: "bg-status-text-danger", text: "text-status-text-danger" },
};
const NOTE: Partial<Record<QuotaState, string>> = { near: "limite yakın", over: "limit doldu" };

/** Dashboard card: messages sent today against each channel's daily limit, plus the cold email warmup notice */
export function QuotaCard({ quota }: { quota: Quota }) {
  const { channels, email_warmup: warmup } = quota;
  if (!channels.length && !warmup.active) return null;
  return (
    <section className="card rise overflow-hidden" style={order(2)} aria-label="Günlük kota">
      <CardHead title="Günlük kota">
        <span className="text-sm text-text-secondary">giden mesaj / limit</span>
      </CardHead>
      {channels.map((c) => {
        const tone = TONE[c.state];
        return (
          <div key={c.channel} className="row flex flex-col gap-3 px-9 py-5">
            <div className="flex items-baseline justify-between gap-4 text-base">
              <span className="truncate">{channelName(c.channel)}</span>
              <span className={`flex-none font-mono text-sm ${tone.text}`}>
                {NOTE[c.state] ? <span className="mr-3 font-sans">{NOTE[c.state]}</span> : null}
                {c.sent} / {c.limit}
              </span>
            </div>
            <span className="track" role="progressbar" aria-label={`${channelName(c.channel)} günlük kota`} aria-valuemin={0} aria-valuemax={c.limit} aria-valuenow={c.sent}>
              <i className={`grow-x ${tone.bar}`} style={{ width: `${Math.min(100, (c.sent / c.limit) * 100)}%` }} />
            </span>
          </div>
        );
      })}
      {warmup.active && warmup.until ? (
        <p className="m-0 px-9 py-5 text-base-sm text-status-text-attention">Soğuk e-posta kapalı: ısınma dönemi {fmtDay(warmup.until)} tarihine kadar sürüyor.</p>
      ) : null}
    </section>
  );
}
