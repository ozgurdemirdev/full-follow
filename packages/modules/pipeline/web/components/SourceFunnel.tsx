import { useState } from "react";
import { useQuery } from "@kit/api/store";
import { pct } from "@kit/lib/format";
import { FUNNEL_PERIODS, FUNNEL_STEP } from "@kit/lib/labels";
import { SectionHead } from "@kit/components/SectionHead";
import { Card, Chip, Empty, ErrorBox, Filters, order } from "@kit/components/ui";

// What `GET /api/report/sources` answers (the report page shows this section through its `report.sections` slot)
/** Lead source funnel: found, written, replied, meeting, offer, won; rate = against the previous step */
export interface FunnelStep {
  key: string;
  count: number;
  rate: number | null;
}
export interface SourceFunnelRow {
  source_id: number;
  source: string;
  steps: FunnelStep[];
  reply_rate: number | null;
  /** too few written messages for the reply rate to mean much */
  early: boolean;
  weak: boolean;
}
export interface FunnelData {
  period: number | "all";
  since: string | null;
  sources: SourceFunnelRow[];
}

/** One source: name with its flags, then the six steps (two rows of three on a phone), each with a bar against the found count and the rate vs the previous step */
function SourceRow({ s }: { s: SourceFunnelRow }) {
  const found = s.steps[0].count;
  return (
    <div className="row flex flex-col gap-4 px-10 py-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Chip tone="source">{s.source}</Chip>
        {s.weak ? <Chip tone="warning">zayıf</Chip> : null}
        {s.early ? <Chip>erken</Chip> : null}
        <span className="ml-auto text-sm text-text-secondary">cevap oranı {pct(s.reply_rate)}</span>
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-5 desk:grid-cols-6 desk:gap-3">
        {s.steps.map((x) => (
          <div key={x.key} className="flex min-w-0 flex-col gap-2">
            <span className="truncate text-xs text-text-muted">{FUNNEL_STEP[x.key] ?? x.key}</span>
            <span className="font-mono text-base">{x.count}</span>
            <span className="track">
              <i className={`grow-x ${s.weak ? "bg-warning" : s.early ? "bg-entity-neutral" : "bg-entity-opportunity"}`} style={{ width: `${found ? (x.count / found) * 100 : 0}%` }} />
            </span>
            <span className="font-mono text-xs text-text-secondary">{pct(x.rate)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Report section: where the people and companies of each lead source got to, by record creation date */
export default function SourceFunnel() {
  const [period, setPeriod] = useState<string | null>(null);
  const q = useQuery<FunnelData>(`/report/sources${period ? `?period=${period}` : ""}`);
  const data = q.data;
  return (
    <Card label="Kaynak hunisi" className="rep-card rep-flush rise" style={order(5)}>
      <SectionHead title="Kaynak hunisi">
        <Filters items={FUNNEL_PERIODS} value={period ?? String(data?.period ?? "")} onChange={setPeriod} label="Dönem" />
      </SectionHead>
      {q.error && !data ? <ErrorBox error={q.error} retry={q.reload} /> : null}
      {data?.sources.length ? data.sources.map((s) => <SourceRow key={s.source_id} s={s} />) : data ? <Empty>Bu dönemde kaynağı olan kişi ya da firma yok.</Empty> : null}
      <p className="rep-foot">
        Her adım, o adıma ulaşan kişi ve firma sayısıdır; yüzde bir önceki adıma göredir. Cevap oranı = cevap / yazıldı. Yazılan mesajı az olan kaynak “erken” sayılır;
        yeterli örneği olanların en düşük üçte biri “zayıf” işaretlenir.
      </p>
    </Card>
  );
}
