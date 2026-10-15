import type { Quota, QuotaState, Today } from "@kit/api/types";
import { Card, Meter } from "@kit/components/ui";
import { fmtDay } from "@kit/lib/format";
import { channelName } from "@kit/lib/network";
import { m } from "../messages";

const PERCENT = 100;

/** Bar colour and count colour per quota state: muted while fine, warning when close, danger when the limit is reached */
const QUOTA_TONE: Record<QuotaState, { bar: string; text: string }> = {
  ok: { bar: "bg-border-strong", text: "text-text-secondary" },
  near: { bar: "bg-warning", text: "text-warning" },
  over: { bar: "bg-danger", text: "text-danger" },
};
const QUOTA_NOTE: Partial<Record<QuotaState, string>> = { near: m.quota.near, over: m.quota.over };

/** Messages sent today against each channel's daily limit, plus the cold email warmup notice */
function QuotaBody({ quota }: { quota: Quota }) {
  const { channels, email_warmup: warmup } = quota;
  return (
    <Card title={m.quota.title} className="dash-gap-6 rise" actions={<span className="text-base-sm text-text-secondary">{m.quota.aside}</span>}>
      {channels.map((c) => {
        const tone = QUOTA_TONE[c.state];
        return (
          <div key={c.channel} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4 text-base">
              <span className="truncate">{channelName(c.channel)}</span>
              <span className={`flex-none font-mono text-sm ${tone.text}`}>
                {QUOTA_NOTE[c.state] ? <span className="mr-3 font-sans">{QUOTA_NOTE[c.state]}</span> : null}
                {c.sent} / {c.limit}
              </span>
            </div>
            <Meter value={(c.sent / c.limit) * PERCENT} size="sm" color={tone.bar} label={m.quota.label(channelName(c.channel))} />
          </div>
        );
      })}
      {warmup.active && warmup.until ? <p className="m-0 text-base-sm text-warning">{m.quota.warmup(fmtDay(warmup.until))}</p> : null}
    </Card>
  );
}

export const QuotaCard = ({ today }: { today: Today }) => <QuotaBody quota={today.quota!} />;
