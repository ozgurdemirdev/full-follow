import { useMemo, useState } from "react";
import { useQuery } from "@kit/api/store";
import type { RefNode, ReferralReport } from "../types";
import { Page } from "@kit/app/Page";
import { Kpis } from "../components/Kpis";
import { Leaders } from "../components/Leaders";
import { Suggestions } from "../components/Suggestions";
import { TreeCard } from "../components/TreeCard";
import { Empty, ErrorBox, order, PageSkeleton } from "@kit/components/ui";
import { m as kit } from "@kit/messages";
import { m } from "../messages";
import { REFERRALS_REPORT } from "../paths";
import { layoutTree, referralKpis } from "../referrals";

const NO_LEADERS: ReferralReport["leaders"] = [];

/** Referrals: who introduced whom, what their network brought, whom to thank and whom to ask next */
export default function Referrals() {
  const report = useQuery<ReferralReport>(REFERRALS_REPORT);
  const [picked, setPicked] = useState<number | null>(null);

  const leaders = report.data?.leaders ?? NO_LEADERS;
  const selected = leaders.find((r) => r.person_id === picked) ?? leaders[0];
  const kpis = useMemo(() => (report.data ? referralKpis(report.data.kpis, leaders) : []), [report.data, leaders]);
  // the tree of the selected person is built by the server: no people book is loaded here
  const treeData = useQuery<RefNode | null>(selected ? `${REFERRALS_REPORT}/tree/${selected.person_id}` : null);
  const tree = useMemo(() => (treeData.data ? layoutTree(treeData.data) : null), [treeData.data]);

  const ready = !!report.data;
  const error = report.error;

  return (
    <Page title={kit.nouns.referrals} sub={m.page.sub} className="flex flex-col gap-10">
      {error && !ready ? <ErrorBox error={error} retry={() => void report.reload()} /> : null}
      {!ready ? (
        !error && <PageSkeleton />
      ) : (
        <>
          <Kpis items={kpis} />
          {leaders.length === 0 || !selected ? (
            <Empty>{m.page.empty}</Empty>
          ) : !tree ? null : (
            <div className="ref-grid rise" style={order(2)}>
              <Leaders rows={leaders} selected={selected.person_id} onPick={setPicked} />
              <TreeCard title={m.page.treeTitle(selected.name)} tree={tree} />
            </div>
          )}
          {report.data ? <Suggestions thanks={report.data.thanks} asks={report.data.asks} /> : null}
        </>
      )}
    </Page>
  );
}
