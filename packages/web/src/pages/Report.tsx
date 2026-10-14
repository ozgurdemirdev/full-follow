import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "../api/store";
import type { List, MarketingReport, MonthReport, Payment, Report as ReportData } from "../api/types";
import { PATHS } from "../app/routes";
import { Page } from "../app/Page";
import { FloorCard } from "../components/report/FloorCard";
import { Hero } from "../components/report/Hero";
import { MonthsCard } from "../components/report/MonthsCard";
import { SourcesCard } from "../components/report/SourcesCard";
import { SourceFunnel } from "../components/SourceFunnel";
import { TemplateCompare } from "../components/TemplateCompare";
import { ErrorBox, PageSkeleton } from "../components/ui";
import { Icon } from "../components/icons";
import { todayIso } from "../lib/format";
import { expectedOf, floorHint, heroOf, incomingOf, monthsAbove, REPORT_MONTHS, scaleTop } from "../lib/report";
import { useFloorCosts } from "../lib/useFloorCosts";

export default function Report() {
  const months = useQuery<MonthReport[]>(`/report/months?count=${REPORT_MONTHS}`);
  const report = useQuery<ReportData>("/report");
  const marketing = useQuery<MarketingReport>("/report/marketing");
  const payments = useQuery<List<Payment>>("/payments?unpaid=true&limit=1000");
  const [sel, setSel] = useState<number | null>(null);

  const list = months.data;
  const today = todayIso();
  const now = today.slice(0, 7);
  const { costs, set, floor } = useFloorCosts(list?.[list.length - 1]?.floor_detail);

  const i = sel ?? (list ? list.length - 1 : 0);
  const m = list?.[i];
  const incoming = useMemo(() => incomingOf(payments.data?.rows ?? [], today), [payments.data, today]);
  const expected = useMemo(() => expectedOf(incoming), [incoming]);

  if (!list || !m || !costs) {
    return (
      <Page title="Rapor" sub="Bu ay ayakta kalmak için ne kadar lazım, ne kadarı geldi">
        {months.error && !months.data ? <ErrorBox error={months.error} retry={months.reload} /> : <PageSkeleton />}
      </Page>
    );
  }

  const top = scaleTop(list, floor, expected.total, now);
  const hero = heroOf(m, floor, expected.total, top, today);

  return (
    <Page
      title="Rapor"
      sub="Bu ay ayakta kalmak için ne kadar lazım, ne kadarı geldi"
      right={<Link href={PATHS.review} className="rep-link">Haftalık inceleme<Icon name="arrow" className="size-icon-md" /></Link>}
    >
      <Hero hero={hero} insight={m.insight} />
      <div className="rep-grid">
        <MonthsCard months={list} floor={floor} top={top} now={now} picked={i} onPick={setSel} above={monthsAbove(list, floor, now)} incoming={incoming} />
        <FloorCard costs={costs} floor={floor} hint={floorHint(floor, report.data?.sources ?? [])} onChange={set} />
      </div>
      <SourcesCard sources={report.data?.sources ?? []} />
      <SourceFunnel />
      {marketing.data ? <TemplateCompare groups={marketing.data.template_groups} /> : null}
    </Page>
  );
}
