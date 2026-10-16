import { useCallback, useMemo, useState } from "react";
import { drained, usePaged } from "../api/paged";
import { useQuery } from "../api/store";
import type { List, Thread } from "../api/types";
import { Page } from "../app/Page";
import { NewThread } from "../components/comments/NewThread";
import { ThreadCard } from "../components/comments/ThreadCard";
import { LoadMore } from "../components/LoadMore";
import { Masonry } from "../components/layout";
import { ErrorBox, PageSkeleton, Segmented } from "../components/ui";
import { ONE_ROW } from "../lib/constants";
import { recentTargets, stateOf, tabFromQuery, TABS, THREADS_SHOWN, type CTab } from "../lib/comments";
import { m as kit } from "../messages";
import { comments } from "../messages.comments";

const m = comments.page;

const NO_THREADS: Thread[] = [];
const OPEN_THREADS = "/comments?messages=true";
const CLOSED_THREADS = "/comments?resolved=true&messages=true";

/** Comments: the owner and Claude write on records; tabs by who is waited for, a composer for a new thread, the threads in two columns */
export default function Comments() {
  // the open threads are read whole; the closed ones (a history that only grows) page in on their own tab, their count is the server's total
  const threads = useQuery<List<Thread>>(OPEN_THREADS, drained);
  // the dashboard links here with ?f=mine (threads waiting for the owner), which is the "Sana soruldu" tab
  const [tab, setTab] = useState<CTab>(() => tabFromQuery(location.search));
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set());
  const [limit, setLimit] = useState(THREADS_SHOWN);
  const closedTab = tab === "closed";
  const closed = usePaged<Thread>(closedTab ? CLOSED_THREADS : null, THREADS_SHOWN);
  const closedCount = useQuery<List<Thread>>(`${CLOSED_THREADS}&limit=${ONE_ROW}`).data?.total ?? 0;
  const rows = threads.data?.rows ?? NO_THREADS;

  const items = useMemo(() => rows.map((t) => ({ t, s: stateOf(t, seen) })), [rows, seen]);
  const counts = useMemo(() => TABS.map((x) => (x.key === "closed" ? closedCount : items.filter((i) => x.states.includes(i.s)).length)), [items, closedCount]);
  const targets = useMemo(() => recentTargets(rows), [rows]);
  const current = TABS.findIndex((x) => x.key === tab);
  const list = useMemo(
    () => (closedTab ? closed.rows.map((t) => ({ t, s: "closed" as const })) : items.filter((i) => TABS[current].states.includes(i.s))),
    [closedTab, closed.rows, items, current],
  );

  const pick = useCallback((key: CTab) => (setTab(key), setLimit(THREADS_SHOWN)), []);
  const markSeen = useCallback((id: number) => setSeen((s) => (s.has(id) ? s : new Set(s).add(id))), []);
  const claudeHas = useCallback(() => pick("claude"), [pick]);
  const shown = closedTab ? list : list.slice(0, limit);
  const remaining = closedTab ? closed.total - list.length : list.length - shown.length;

  return (
    <Page
      title={kit.nouns.comments}
      sub={m.sub}
      right={<Segmented label={m.tabs} size="lg" value={current} onChange={(i) => pick(TABS[i].key)} items={TABS.map((x, i) => ({ label: x.label, dot: x.dot, count: counts[i] }))} />}
    >
      {threads.error && !threads.data ? <ErrorBox error={threads.error} retry={threads.reload} /> : null}
      {!threads.data ? (
        !threads.error && <PageSkeleton />
      ) : (
        <>
          {targets.length ? <NewThread targets={targets} onOpened={claudeHas} /> : null}
          {list.length === 0 && !(closedTab && closed.pending) ? (
            <p className="cmt-empty">{TABS[current].empty}</p>
          ) : (
            <div className="cmt-feed">
              <Masonry columns={2}>
                {shown.map((i) => <ThreadCard key={i.t.id} t={i.t} state={i.s} onSeen={markSeen} onReopened={pick} />)}
              </Masonry>
              {closedTab ? <LoadMore hasMore={closed.hasMore} loaded={list.length} onMore={closed.loadMore} /> : null}
              {remaining > 0 ? (
                <button type="button" className="btn btn-ghost self-start" onClick={() => (closedTab ? closed.loadMore() : setLimit((n) => n + THREADS_SHOWN))}>{m.more(remaining)}</button>
              ) : null}
            </div>
          )}
        </>
      )}
    </Page>
  );
}
