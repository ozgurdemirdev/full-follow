import { useCallback, useMemo, useState } from "react";
import { K, useIndex } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Draft, List } from "@kit/api/types";
import { Page } from "@kit/app/Page";
import { openSheet } from "@kit/app/ui";
import { AddButton } from "@kit/components/AddButton";
import { DraftHistory } from "../components/DraftHistory";
import { DraftReview, type Handled } from "../components/DraftReview";
import { MotionScope } from "@kit/components/MotionScope";
import { ErrorBox, PageSkeleton, Segmented } from "@kit/components/ui";
import { ONE_ROW } from "@kit/lib/constants";
import { draftsOf, TABS, type DraftRules } from "../drafts";
import { m } from "../messages";

const NO_RULES: string[] = [];


/** Drafts: the approval queue as a card stack, and the sent and rejected lists */
export default function Drafts() {
  // the queue (waiting and approved drafts) is read whole; the sent and rejected lists page on their own, their tab counts are the server's totals
  const waiting = useIndex<Draft>(draftsOf("bekliyor"));
  const approved = useIndex<Draft>(draftsOf("onaylandi"));
  const sent = useQuery<List<Draft>>(`${draftsOf("gonderildi")}&limit=${ONE_ROW}`);
  const rejected = useQuery<List<Draft>>(`${draftsOf("reddedildi")}&limit=${ONE_ROW}`);
  const settings = useQuery<DraftRules>(K.settings);
  const [tab, setTab] = useState(0);
  const [handled, setHandled] = useState<Handled[]>([]);
  const handledIds = useMemo(() => new Set(handled.map((h) => h.id)), [handled]);
  const queue = useMemo(
    () => [...waiting.rows, ...approved.rows].filter((d) => !handledIds.has(d.id)).sort((a, b) => b.id - a.id),
    [waiting.rows, approved.rows, handledIds],
  );
  const counts = [queue.length, sent.data?.total ?? 0, rejected.data?.total ?? 0];
  const ready = !!waiting.data && !!approved.data;
  const error = waiting.error ?? approved.error;
  const onHandled = useCallback((h: Handled) => setHandled((list) => [...list, h]), []);

  return (
    <Page title={m.label} sub={m.page.sub}
      right={
        <div className="drf-head">
          <div className="drf-tabs">
            <Segmented label={m.page.status} size="lg" value={tab} onChange={setTab} items={TABS.map((t, i) => ({ label: t.label, count: counts[i] }))} />
          </div>
          <AddButton label={m.page.write} onClick={() => openSheet("draft")} />
        </div>
      }>
      {error && !ready ? <ErrorBox error={error} retry={() => { void waiting.reload(); void approved.reload(); }} /> : null}
      {!ready ? (
        !error && <PageSkeleton />
      ) : (
        <MotionScope>
          {tab === 0
            ? <DraftReview pending={queue} handled={handled} onHandled={onHandled} rules={settings.data?.draft_rules ?? NO_RULES} />
            : <DraftHistory status={tab === 2 ? "reddedildi" : "gonderildi"} />}
        </MotionScope>
      )}
    </Page>
  );
}
