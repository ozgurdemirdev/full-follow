import { useCallback, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { qs } from "@kit/api/client";
import { K, useOpenTasks } from "@kit/api/keys";
import { usePaged } from "@kit/api/paged";
import { useQuery } from "@kit/api/store";
import type { PeopleOverview, Person, Today } from "@kit/api/types";
import { Page } from "@kit/app/Page";
import { openSheet } from "@kit/app/ui";
import { BoardIcon } from "@kit/components/boardIcons";
import { noFilter, type LabelFilter } from "@kit/components/filters";
import { PEOPLE_PATH } from "../paths";
import { type StatusFilter } from "../components/FilterBar";
import { PeopleList } from "../components/PeopleList";
import { PersonOverlay } from "../components/PersonOverlay";
import { TouchCards } from "../components/TouchCards";
import { ErrorBox, PageSkeleton } from "@kit/components/ui";
import { LIST_PAGE, SEARCH_DEBOUNCE_MS } from "@kit/lib/constants";
import { todayIso } from "@kit/lib/format";
import { useDebounced } from "@kit/lib/useDebounced";
import { m as kit } from "@kit/messages";

import { m } from "../messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

const OVERVIEW = "/people/overview";
const SUMMARY = "/people/summary";
const ZERO_COUNTS: Record<StatusFilter, number> = { all: 0, due: 0, wait: 0, cold: 0, fresh: 0 };

/** Size of the box the overlay grows from when a person is opened by address, not by a click */
const FALLBACK_BOX = { width: 240, height: 140 };
const fallbackRect = () => new DOMRect((innerWidth - FALLBACK_BOX.width) / 2, (innerHeight - FALLBACK_BOX.height) / 2, FALLBACK_BOX.width, FALLBACK_BOX.height);

/** Kişi sayısı ve soğuyan ilişki sayısı: tüm defterin, filtreden bağımsız */
interface PeopleSummary {
  people: number;
  cooling: number;
}

/** People: "Bugün dokun" cards, the filterable list, and the person overlay (the address /kisiler/:id opens it) */
export default function People() {
  const tasks = useOpenTasks();
  const today = useQuery<Today>(K.today);
  const summary = useQuery<PeopleSummary>(SUMMARY);
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [chan, setChan] = useState<string | null>(null);
  const [labels, setLabels] = useState<LabelFilter>(noFilter);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState<DOMRect | null>(null);
  const day = todayIso();
  const openId = Number(params.id) || null;

  // every filter goes to the server; the list pages through the answer as the end is scrolled into view
  const search = useDebounced(q.trim(), SEARCH_DEBOUNCE_MS);
  const list = usePaged<Person, Pick<PeopleOverview, "counts">>(
    `${OVERVIEW}${qs({ q: search, state: status === "all" ? undefined : status, has_channel: chan, ...labels })}`,
    LIST_PAGE,
  );
  const counts: Record<StatusFilter, number> = list.extra?.counts ?? ZERO_COUNTS;
  const ownTasks = useMemo(() => tasks.rows.filter((t) => t.assignee !== "claude"), [tasks.rows]);
  // stable, so the memoized rows do not re-render when the overlay opens
  const open = useCallback((id: number, el: HTMLElement) => {
    setFrom(el.getBoundingClientRect());
    navigate(`${PEOPLE_PATH}/${id}`, { replace: true });
  }, [navigate]);
  const week = today.data?.week ? today.data.week.sent + today.data.week.replies : null;
  const sub = summary.data ? m.page.sub(summary.data.people, week, summary.data.cooling) : "";
  const started = list.rows.length > 0 || !list.pending;

  return (
    <Page
      title={kit.nouns.people}
      sub={sub}
      className="flex flex-col gap-10"
      right={
        <div className="ppl-tools">
          <label className="ppl-search">
            <BoardIcon name="search" className="size-icon-md" stroke={STROKE.thin} />
            <span className="sr-only">{m.searchPerson}</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.page.searchPlaceholder} />
          </label>
          <button type="button" className="dash-new" onClick={() => openSheet("person")}>
            <BoardIcon name="plus" className="size-icon-md" stroke={STROKE.medium} />
            {m.page.add}
          </button>
        </div>
      }
    >
      {list.error && !list.rows.length ? <ErrorBox error={list.error} retry={list.reload} /> : null}
      {!started ? (
        !list.error && <PageSkeleton />
      ) : (
        <>
          <TouchCards today={day} onOpen={open} />
          <PeopleList rows={list.rows} total={list.total} more={{ hasMore: list.hasMore, onMore: list.loadMore }} tasks={ownTasks} today={day} counts={counts}
            empty={!list.pending} status={status} onStatus={setStatus} chan={chan} onChan={setChan} labels={labels} onLabels={setLabels} onOpen={open} />
          <PersonOverlay id={openId} from={openId ? (from ?? fallbackRect()) : from} p={openId ? list.rows.find((p) => p.id === openId) : undefined}
            onClose={() => navigate(PEOPLE_PATH, { replace: true })} />
        </>
      )}
    </Page>
  );
}
