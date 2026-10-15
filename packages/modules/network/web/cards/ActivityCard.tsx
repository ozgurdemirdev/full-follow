import { useState } from "react";
import { isMissing } from "@kit/api/modules";
import { useQuery } from "@kit/api/store";
import type { Activity, ActivityBucket } from "@kit/api/types";
import { fmtNum, toDate } from "@kit/lib/format";
import { WEEKDAY_SHORT } from "@kit/lib/labels";
import { Card } from "@kit/components/ui";

/** Days shown in the weekly activity card (the current day is the last bar) */
const ACTIVITY_DAYS = 7;

const METRICS = [
  { key: "temas", label: "Temas", unit: "temas", count: (b: ActivityBucket) => b.sent + b.replies },
  { key: "taslak", label: "Taslak", unit: "taslak", count: (b: ActivityBucket) => b.drafts },
  { key: "teklif", label: "Teklif", unit: "teklif", count: (b: ActivityBucket) => b.offers },
];
/** The scale tops at a multiple of this many, so the middle tick is a round half */
const SCALE_STEP = 3;
/** Even an empty day keeps a sliver of bar (percent of the scale) */
const MIN_BAR = 6;
const PERCENT = 100;

const sum = (list: ActivityBucket[], count: (b: ActivityBucket) => number) => list.reduce((s, b) => s + count(b), 0);
const dayLabel = (b: ActivityBucket, last: boolean) => (last ? "Bugün" : WEEKDAY_SHORT[(toDate(b.start).getDay() + 6) % 7]);

/** "Haftalık aktivite": the last seven days of touches, drafts or offers, a bar per day */
export function ActivityCard() {
  const [metric, setMetric] = useState(0);
  const [pick, setPick] = useState(ACTIVITY_DAYS - 1);
  const q = useQuery<Activity>("/stats/activity?period=day");
  if (isMissing(q.error)) return null;
  const m = METRICS[metric];
  const buckets = q.data?.buckets ?? [];
  const week = buckets.slice(-ACTIVITY_DAYS);
  const before = buckets.slice(-ACTIVITY_DAYS * 2, -ACTIVITY_DAYS);
  const vals = week.map(m.count);
  const total = sum(week, m.count);
  const prev = sum(before, m.count);
  const diff = total - prev;
  const top = Math.max(SCALE_STEP, Math.ceil(Math.max(0, ...vals) / SCALE_STEP) * SCALE_STEP);
  const delta = diff > 0 ? `+${diff} geçen haftaya göre` : diff < 0 ? `${-diff} eksik, geçen hafta ${prev}` : "geçen haftayla aynı";

  return (
    <Card title="Haftalık aktivite" className="dash-gap-8 dash-wrap-head rise"
      actions={
        <div className="dash-metric" role="group" aria-label="Ölçü">
          {METRICS.map((x, i) => <button key={x.key} type="button" aria-pressed={metric === i} onClick={() => setMetric(i)}>{x.label}</button>)}
        </div>
      }>
      <div className="flex flex-wrap items-baseline gap-4">
        <span className="text-display leading-none tracking-kpi">{total}</span>
        <span className="text-base text-text-secondary">{m.unit}</span>
        {q.data ? <span className={`text-base-sm ${diff >= 0 ? "text-accent" : "text-danger-soft"}`}>{delta}</span> : null}
      </div>
      <div className="flex gap-5">
        <div className="dash-axis" aria-hidden="true">
          <span>{fmtNum(top)}</span><span>{fmtNum(top / 2)}</span><span>0</span>
        </div>
        <div className="grid flex-grow grid-cols-7 gap-4">
          {week.map((b, i) => {
            const sel = pick === i;
            const share = Math.max(MIN_BAR, Math.round((vals[i] / top) * PERCENT));
            const label = dayLabel(b, i === week.length - 1);
            return (
              <button key={b.start} type="button" className="dash-bar" aria-pressed={sel} aria-label={`${label}: ${vals[i]} ${m.unit}`} onClick={() => setPick(i)}>
                <div className="dash-bar-well">
                  <div className="dash-bar-fill" style={{ height: `${share}%` }} />
                  {sel ? <span className="dash-bar-tip" style={{ bottom: `${share}%` }}>{vals[i]}</span> : null}
                </div>
                <span className={`text-center text-sm ${sel ? "text-text-primary" : "text-text-muted"}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
