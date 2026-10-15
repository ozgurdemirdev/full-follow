import { useMemo, useState } from "react";
import { useOpps, usePeople } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { ReferralReport } from "../types";
import { Page } from "@kit/app/Page";
import { Kpis } from "../components/Kpis";
import { Leaders } from "../components/Leaders";
import { Suggestions } from "../components/Suggestions";
import { TreeCard } from "../components/TreeCard";
import { Empty, ErrorBox, order, PageSkeleton } from "@kit/components/ui";
import { m as kit } from "@kit/messages";
import { m } from "../messages";
import { REFERRALS_REPORT } from "../paths";
import { buildTree, layoutTree, ownValues, referralKpis } from "../referrals";

const NO_LEADERS: ReferralReport["leaders"] = [];

/** Referrals: who introduced whom, what their network brought, whom to thank and whom to ask next */
export default function Referrals() {
  const report = useQuery<ReferralReport>(REFERRALS_REPORT);
  const people = usePeople();
  const opps = useOpps();
  const [picked, setPicked] = useState<number | null>(null);

  const leaders = report.data?.leaders ?? NO_LEADERS;
  const selected = leaders.find((r) => r.person_id === picked) ?? leaders[0];
  const own = useMemo(() => ownValues(opps.rows), [opps.rows]);
  const kpis = useMemo(() => referralKpis(people.rows, opps.rows, leaders), [people.rows, opps.rows, leaders]);
  const tree = useMemo(() => {
    const root = selected ? buildTree(selected.person_id, people.rows, own) : null;
    return root ? layoutTree(root) : null;
  }, [selected, people.rows, own]);

  const ready = !!(report.data && people.data && opps.data);
  const error = report.error ?? people.error ?? opps.error;

  return (
    <Page title={kit.nouns.referrals} sub={m.page.sub} className="flex flex-col gap-10">
      {error && !ready ? <ErrorBox error={error} retry={() => { report.reload(); people.reload(); opps.reload(); }} /> : null}
      {!ready ? (
        !error && <PageSkeleton />
      ) : (
        <>
          <Kpis items={kpis} />
          {leaders.length === 0 || !selected || !tree ? (
            <Empty>{m.page.empty}</Empty>
          ) : (
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
