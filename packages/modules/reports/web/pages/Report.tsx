import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@kit/api/store";
import { drained } from "@kit/api/paged";
import type { List, MonthReport, Payment, Report as ReportData } from "@kit/api/types";
import { Slot } from "@kit/app/modules/Slot";
import { Page } from "@kit/app/Page";
import { FloorCard } from "../components/FloorCard";
import { Hero } from "../components/Hero";
import { MonthsCard } from "../components/MonthsCard";
import { SourcesCard } from "../components/SourcesCard";
import { ErrorBox, PageSkeleton } from "@kit/components/ui";
import { Icon } from "@kit/components/icons";
import { todayIso } from "@kit/lib/format";
import { m } from "../messages";
import { REVIEW_PATH } from "../paths";
import { expectedOf, floorHint, heroOf, incomingOf, monthsAbove, REPORT_MONTHS, scaleTop } from "../report";
import { useFloorCosts } from "../useFloorCosts";

export default function Report() {
  const months = useQuery<MonthReport[]>(`/report/months?count=${REPORT_MONTHS}`);
  const report = useQuery<ReportData>("/report");
  const payments = useQuery<List<Payment>>("/payments?unpaid=true", drained);
  const [sel, setSel] = useState<number | null>(null);

  const list = months.data;
  const today = todayIso();
  const now = today.slice(0, 7);
  const { costs, set, floor } = useFloorCosts(list?.[list.length - 1]?.floor_detail);

  const i = sel ?? (list ? list.length - 1 : 0);
  const month = list?.[i];
  const incoming = useMemo(() => incomingOf(payments.data?.rows ?? [], today), [payments.data, today]);
  const expected = useMemo(() => expectedOf(incoming), [incoming]);

  if (!list || !month || !costs) {
    return (
      <Page title={m.page.title} sub={m.page.sub}>
        {months.error && !months.data ? <ErrorBox error={months.error} retry={months.reload} /> : <PageSkeleton />}
      </Page>
    );
  }

  const top = scaleTop(list, floor, expected.total, now);
  const hero = heroOf(month, floor, expected.total, top, today);

  return (
    <Page
      title={m.page.title}
      sub={m.page.sub}
      right={<Link href={REVIEW_PATH} className="rep-link">{m.page.review}<Icon name="arrow" className="size-icon-md" /></Link>}
    >
      <Hero hero={hero} insight={month.insight} />
      <div className="rep-grid">
        <MonthsCard months={list} floor={floor} top={top} now={now} picked={i} onPick={setSel} above={monthsAbove(list, floor, now)} incoming={incoming} />
        <FloorCard costs={costs} floor={floor} hint={floorHint(floor, report.data?.sources ?? [])} onChange={set} />
      </div>
      <SourcesCard sources={report.data?.sources ?? []} />
      <Slot name="report.sections" />
    </Page>
  );
}
