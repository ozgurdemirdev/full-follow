import { useMemo, useState } from "react";
import { K, useOpenTasks, useOpps, usePeople, useProjects } from "../api/keys";
import { useQuery } from "../api/store";
import type { Draft, List, Payment, ReferralValue } from "../api/types";
import { Page } from "../app/Page";
import { Kpis } from "../components/referrals/Kpis";
import { Leaders } from "../components/referrals/Leaders";
import { Suggestions } from "../components/referrals/Suggestions";
import { TreeCard } from "../components/referrals/TreeCard";
import { Empty, ErrorBox, order, PageSkeleton } from "../components/ui";
import { asksList, buildTree, layoutTree, ownValues, referralKpis, thanksList } from "../lib/referrals";

/** Unpaid payments, shared with the dashboard's collection card; the late ones decide who is not asked yet */
const UNPAID = "/payments?unpaid=true&limit=1000";

/** Referrals: who introduced whom, what their network brought, whom to thank and whom to ask next */
export default function Referrals() {
  const report = useQuery<ReferralValue[]>(K.referrals);
  const people = usePeople();
  const opps = useOpps();
  const projects = useProjects();
  const tasks = useOpenTasks();
  const drafts = useQuery<List<Draft>>(K.drafts);
  const unpaid = useQuery<List<Payment>>(UNPAID);
  const [picked, setPicked] = useState<number | null>(null);

  const leaders = report.data ?? [];
  const selected = leaders.find((r) => r.person_id === picked) ?? leaders[0];
  const own = useMemo(() => ownValues(opps.rows), [opps.rows]);
  const kpis = useMemo(() => referralKpis(people.rows, opps.rows, leaders), [people.rows, opps.rows, leaders]);
  const tree = useMemo(() => {
    const root = selected ? buildTree(selected.person_id, people.rows, own) : null;
    return root ? layoutTree(root) : null;
  }, [selected, people.rows, own]);
  const lists = useMemo(() => {
    if (!people.data || !opps.data || !projects.data || !tasks.data || !drafts.data || !unpaid.data) return null;
    const d = { people: people.rows, opps: opps.rows, projects: projects.rows, payments: unpaid.data.rows, tasks: tasks.rows, drafts: drafts.data.rows };
    return { thanks: thanksList(d), asks: asksList(d) };
  }, [people.data, people.rows, opps.data, opps.rows, projects.data, projects.rows, tasks.data, tasks.rows, drafts.data, unpaid.data]);

  const ready = !!(report.data && people.data && opps.data);
  const error = report.error ?? people.error ?? opps.error;

  return (
    <Page title="Referanslar" sub="Kim kimi tanıttı, tanıştırdıklarından ve onların ağından ne iş çıktı" className="flex flex-col gap-10">
      {error && !ready ? <ErrorBox error={error} retry={() => { report.reload(); people.reload(); opps.reload(); }} /> : null}
      {!ready ? (
        !error && <PageSkeleton />
      ) : (
        <>
          <Kpis items={kpis} />
          {leaders.length === 0 || !selected || !tree ? (
            <Empty>Henüz kimse kimseyi tanıtmadı. Kişi eklerken “Tanıtan” alanını doldurunca burada görünür.</Empty>
          ) : (
            <div className="ref-grid rise" style={order(2)}>
              <Leaders rows={leaders} selected={selected.person_id} onPick={setPicked} />
              <TreeCard title={`${selected.name} ağı`} tree={tree} />
            </div>
          )}
          {lists ? <Suggestions thanks={lists.thanks} asks={lists.asks} /> : null}
        </>
      )}
    </Page>
  );
}
