import { useCallback, useMemo, useState } from "react";
import { K, usePeople } from "../api/keys";
import { useQuery } from "../api/store";
import type { Draft, List } from "../api/types";
import { Page } from "../app/Page";
import { openSheet } from "../app/ui";
import { BoardIcon } from "../components/boardIcons";
import { DraftHistory } from "../components/drafts/DraftHistory";
import { DraftReview, type Handled } from "../components/drafts/DraftReview";
import { MotionScope } from "../components/MotionScope";
import { ErrorBox, PageSkeleton, Segmented } from "../components/ui";
import { TABS, type DraftRules } from "../lib/drafts";

const NO_RULES: string[] = [];

/** Drafts: the approval queue as a card stack, and the sent and rejected lists */
export default function Drafts() {
  const drafts = useQuery<List<Draft>>(K.drafts);
  const settings = useQuery<DraftRules>(K.settings);
  const people = usePeople();
  const [tab, setTab] = useState(0);
  const [handled, setHandled] = useState<Handled[]>([]);
  const rows = drafts.data?.rows;
  const handledIds = useMemo(() => new Set(handled.map((h) => h.id)), [handled]);

  const lists = useMemo(() => TABS.map((t) => (rows ?? []).filter((d) => t.test(d) && !(t.key === "pending" && handledIds.has(d.id)))), [rows, handledIds]);
  const history = useMemo(() => (tab === 0 ? [] : lists[tab].slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at))), [lists, tab]);
  const onHandled = useCallback((h: Handled) => setHandled((list) => [...list, h]), []);
  const personOf = useCallback((id: number | null) => (id ? people.byId.get(id) : undefined), [people.byId]);

  return (
    <Page title="Taslaklar" sub="Claude yazar, sen okuyup gönderirsin. Gönderdiğin her mesaj temas olarak kaydedilir."
      right={
        <div className="drf-head">
          <div className="drf-tabs">
            <Segmented label="Taslak durumu" size="lg" value={tab} onChange={setTab} items={TABS.map((t, i) => ({ label: t.label, count: lists[i].length }))} />
          </div>
          <button type="button" className="dash-new" onClick={() => openSheet("draft")}>
            <BoardIcon name="plus" className="size-icon-md" stroke={2.2} />
            Taslak yaz
          </button>
        </div>
      }>
      {drafts.error && !drafts.data ? <ErrorBox error={drafts.error} retry={drafts.reload} /> : null}
      {!drafts.data ? (
        !drafts.error && <PageSkeleton />
      ) : (
        <MotionScope>
          {tab === 0
            ? <DraftReview pending={lists[0]} handled={handled} onHandled={onHandled} personOf={personOf} rules={settings.data?.draft_rules ?? NO_RULES} />
            : <DraftHistory rows={history} rejected={tab === 2} />}
        </MotionScope>
      )}
    </Page>
  );
}
