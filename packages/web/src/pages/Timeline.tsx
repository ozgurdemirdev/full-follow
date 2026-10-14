import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useLocation, useParams } from "wouter";
import { qs } from "../api/client";
import { useCompanies, useOwnProjects } from "../api/keys";
import { useModules } from "../api/modules";
import { useQuery } from "../api/store";
import type { Detail, List, Thread, TimelineEvent, TlPage, TlRec, TlType, TlWeekData, Touch } from "../api/types";
import { Page } from "../app/Page";
import { PATHS, timelinePath } from "../app/routes";
import { BoardIcon } from "../components/boardIcons";
import { FeedComposer } from "../components/Feed";
import { DayGroups } from "../components/timeline/DayGroups";
import { FeedFilters } from "../components/timeline/Filters";
import { FocusCard } from "../components/timeline/FocusCard";
import { LoadMore } from "../components/timeline/LoadMore";
import { detailKey, RecordAside, type AnyRow } from "../components/timeline/RecordCards";
import { WeekStrip } from "../components/timeline/WeekStrip";
import { Empty, ErrorBox, order, PageSkeleton } from "../components/ui";
import type { Actor } from "../lib/labels";
import { canFocus, focusSummary, groupDays, isAsideKind, STAGE_EVENTS_LIMIT, TL_SEARCH_DEBOUNCE_MS, TL_TYPES, weekView } from "../lib/timeline";
import { useDebounced } from "../lib/useDebounced";
import { useTimelineFeed } from "../lib/useTimelineFeed";

/** Rows the side cards of a focused record ask for: the person's touches (their counts) and the record's comment threads (the open one) */
const SIDE_LIMIT = 1000;
const THREADS_LIMIT = 50;

/** Timeline: everything Özgür and Claude did, newest first. /zaman/:type/:id focuses one record. */
export default function Timeline() {
  const params = useParams<{ type?: string; id?: string }>();
  const [, navigate] = useLocation();
  const kind = params.type;
  const id = Number(params.id) || 0;
  const { has } = useModules();
  const focusKey = kind && id && canFocus(kind, has) ? `${kind}:${id}` : null;
  const aside = focusKey && isAsideKind(kind) ? kind : null;

  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), TL_SEARCH_DEBOUNCE_MS);
  const [actor, setActor] = useState<"all" | Actor>("all");
  const [hidden, setHidden] = useState<ReadonlySet<TlType>>(new Set());
  const shownTypes = TL_TYPES.filter((t) => !hidden.has(t.key)).map((t) => t.key);

  const feed = useTimelineFeed({
    type: shownTypes.length === TL_TYPES.length ? undefined : shownTypes.join(","),
    actor: actor === "all" ? undefined : actor,
    q: dq,
    record: focusKey,
  }, shownTypes.length > 0);
  const week = useQuery<TlWeekData>("/timeline/week");
  const latest = useQuery<TlPage>(focusKey ? `/timeline${qs({ record: focusKey, limit: 1 })}` : null);
  const detail = useQuery<Detail<any>>(aside ? detailKey(aside, id) : null);
  const stageEvents = useQuery<TimelineEvent[]>(aside ? `/timeline/${aside}/${id}?limit=${STAGE_EVENTS_LIMIT}` : null);
  const touches = useQuery<List<Touch>>(aside === "person" ? `/touches${qs({ person_id: id, limit: SIDE_LIMIT })}` : null);
  const threads = useQuery<List<Thread>>(aside ? `/comments${qs({ target_type: aside, target_id: id, resolved: "all", limit: THREADS_LIMIT })}` : null);
  const companies = useCompanies(kind === "company" && !!focusKey);
  const ownProjects = useOwnProjects(kind === "own_project" && !!focusKey);

  const focus = useMemo<TlRec | null>(() => {
    if (!focusKey || !kind) return null;
    const row = detail.data?.row as AnyRow | undefined;
    const name = aside ? (kind === "opportunity" ? row?.title : row?.name)
      : kind === "company" ? companies.byId.get(id)?.name : ownProjects.byId.get(id)?.name;
    return name ? { kind, id, name } : null;
  }, [focusKey, kind, id, aside, detail.data, companies.byId, ownProjects.byId]);

  const days = useMemo(() => groupDays(feed.rows, feed.counts), [feed.rows, feed.counts]);
  const weekTiles = useMemo(() => (week.data ? weekView(week.data) : null), [week.data]);

  const onFocus = useCallback((r: TlRec) => {
    setQ("");
    navigate(timelinePath(r.kind, r.id));
  }, [navigate]);
  const toggle = useCallback((t: TlType) => setHidden((h) => {
    const next = new Set(h);
    if (!next.delete(t)) next.add(t);
    return next;
  }), []);

  const search = (
    <label className="tlx-search">
      <BoardIcon name="search" className="size-icon-md" stroke={1.8} />
      <span className="sr-only">Kayıt ara</span>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kişi, fırsat ya da proje ara" />
    </label>
  );
  const frame = (children: ReactNode) => <Page title="Zaman çizelgesi" sub="Sen ve Claude ne yaptınız, kayıt kayıt" right={search}>{children}</Page>;

  if (feed.error && !feed.ready) return frame(<ErrorBox error={feed.error} retry={feed.reload} />);
  if (aside && detail.error && !detail.data) return frame(<ErrorBox error={detail.error} retry={detail.reload} />);
  const lookedUp = aside ? !!detail.data : kind === "company" ? !!companies.data : kind === "own_project" ? !!ownProjects.data : true;
  if (focusKey && !focus && lookedUp) return frame(<Empty>Kayıt bulunamadı</Empty>);
  if (!feed.ready || (!week.data && !week.error) || (focusKey && !focus)) return frame(<PageSkeleton />);

  const openThread = threads.data?.rows.find((t) => !t.resolved_at);
  const list = (
    <div className="tlx-feed rise" style={order(3)}>
      <FeedFilters actor={actor} onActor={setActor} hidden={hidden} onToggle={toggle} />
      <DayGroups days={days} onFocus={onFocus} />
      {feed.rows.length === 0 ? <p className="tlx-empty">Bu süzgeçte olay yok.</p> : null}
      {feed.next ? <LoadMore onMore={feed.loadMore} busy={feed.paging} /> : null}
      {aside && focus ? <div className="tlx-composer"><FeedComposer type={aside} id={id} label={focus.name} openThread={openThread} /></div> : null}
    </div>
  );

  return frame(
    <>
      {focus ? <FocusCard rec={focus} summary={focusSummary(latest.data, stageEvents.data?.[0]?.created_at)} onClear={() => navigate(PATHS.timeline)} /> : null}
      {weekTiles ? <WeekStrip week={weekTiles} className="rise" style={order(2)} /> : null}
      {aside && detail.data ? (
        <div className="tlx-with-aside">
          {list}
          <RecordAside key={focusKey} type={aside} id={id} detail={detail.data} touches={touches.data?.rows ?? []} />
        </div>
      ) : list}
    </>,
  );
}
