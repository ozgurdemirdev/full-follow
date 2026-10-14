import { useCallback, useMemo, useState } from "react";
import { K } from "../api/keys";
import { useQuery } from "../api/store";
import type { List, Thread } from "../api/types";
import { Page } from "../app/Page";
import { NewThread } from "../components/comments/NewThread";
import { ThreadCard } from "../components/comments/ThreadCard";
import { Masonry } from "../components/layout";
import { ErrorBox, PageSkeleton, Segmented } from "../components/ui";
import { recentTargets, stateOf, tabFromQuery, TABS, THREADS_SHOWN, type CTab } from "../lib/comments";

const NO_THREADS: Thread[] = [];

/** Comments: Özgür and Claude write on records; tabs by who is waited for, a composer for a new thread, the threads in two columns */
export default function Comments() {
  const threads = useQuery<List<Thread>>(K.allThreads);
  // the dashboard links here with ?f=mine (threads waiting for Özgür), which is the "Sana soruldu" tab
  const [tab, setTab] = useState<CTab>(() => tabFromQuery(location.search));
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set());
  const [limit, setLimit] = useState(THREADS_SHOWN);
  const rows = threads.data?.rows ?? NO_THREADS;

  const items = useMemo(() => rows.map((t) => ({ t, s: stateOf(t, seen) })), [rows, seen]);
  const counts = useMemo(() => TABS.map((x) => items.filter((i) => x.states.includes(i.s)).length), [items]);
  const targets = useMemo(() => recentTargets(rows), [rows]);
  const current = TABS.findIndex((x) => x.key === tab);
  const list = useMemo(() => items.filter((i) => TABS[current].states.includes(i.s)), [items, current]);

  const pick = useCallback((key: CTab) => (setTab(key), setLimit(THREADS_SHOWN)), []);
  const markSeen = useCallback((id: number) => setSeen((s) => (s.has(id) ? s : new Set(s).add(id))), []);
  const claudeHas = useCallback(() => pick("claude"), [pick]);
  const shown = list.slice(0, limit);

  return (
    <Page
      title="Yorumlar"
      sub="Sen ve Claude, kayıtların üstünde konuşursunuz. Son söz sendeyse Claude cevaplar."
      right={<Segmented label="Konular" size="lg" value={current} onChange={(i) => pick(TABS[i].key)} items={TABS.map((x, i) => ({ label: x.label, dot: x.dot, count: counts[i] }))} />}
    >
      {threads.error && !threads.data ? <ErrorBox error={threads.error} retry={threads.reload} /> : null}
      {!threads.data ? (
        !threads.error && <PageSkeleton />
      ) : (
        <>
          {targets.length ? <NewThread targets={targets} onOpened={claudeHas} /> : null}
          {list.length === 0 ? (
            <p className="cmt-empty">{TABS[current].empty}</p>
          ) : (
            <div className="cmt-feed">
              <Masonry columns={2}>
                {shown.map((i) => <ThreadCard key={i.t.id} t={i.t} state={i.s} onSeen={markSeen} onReopened={pick} />)}
              </Masonry>
              {list.length > shown.length ? (
                <button type="button" className="btn btn-ghost self-start" onClick={() => setLimit((n) => n + THREADS_SHOWN)}>{list.length - shown.length} konu daha</button>
              ) : null}
            </div>
          )}
        </>
      )}
    </Page>
  );
}
