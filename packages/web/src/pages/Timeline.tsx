import { useCallback, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useLocation, useParams } from "wouter";
import { useCompanies, useOwnProjects } from "../api/keys";
import { useQuery } from "../api/store";
import type { Detail, TimelineEvent, TlRec, TlType } from "../api/types";
import { Page } from "../app/Page";
import { PATHS, timelinePath } from "../app/routes";
import { BoardIcon } from "../components/boardIcons";
import { FeedComposer } from "../components/Feed";
import { DayGroups } from "../components/timeline/DayGroups";
import { FeedFilters } from "../components/timeline/Filters";
import { FocusCard } from "../components/timeline/FocusCard";
import { detailKey, RecordAside, type AnyRow } from "../components/timeline/RecordCards";
import { WeekStrip } from "../components/timeline/WeekStrip";
import { Empty, ErrorBox, order, PageSkeleton } from "../components/ui";
import type { Actor } from "../lib/labels";
import {
  dayCounts, filterFeed, focusSummary, groupDays, isAsideKind, recKind, STAGE_EVENTS_LIMIT, TL_PAGE, useTimelineFeed, weekStats, withStageEvents,
} from "../lib/timeline";

/** Timeline: everything Özgür and Claude did, newest first. /zaman/:type/:id focuses one record. */
export default function Timeline() {
  const params = useParams<{ type?: string; id?: string }>();
  const [, navigate] = useLocation();
  const kind = params.type;
  const id = Number(params.id) || 0;
  const focusKey = kind && id && recKind(kind).focus ? `${kind}:${id}` : null;
  const aside = focusKey && isAsideKind(kind) ? kind : null;

  const feed = useTimelineFeed();
  const detail = useQuery<Detail<any>>(aside ? detailKey(aside, id) : null);
  const stageEvents = useQuery<TimelineEvent[]>(aside ? `/timeline/${aside}/${id}?limit=${STAGE_EVENTS_LIMIT}` : null);
  const companies = useCompanies(kind === "company" && !!focusKey);
  const ownProjects = useOwnProjects(kind === "own_project" && !!focusKey);

  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [actor, setActor] = useState<"all" | Actor>("all");
  const [hidden, setHidden] = useState<ReadonlySet<TlType>>(new Set());
  const [pg, setPg] = useState({ key: "", n: TL_PAGE });

  const focus = useMemo<TlRec | null>(() => {
    if (!focusKey || !kind) return null;
    const row = detail.data?.row as AnyRow | undefined;
    const name = aside ? (kind === "opportunity" ? row?.title : row?.name)
      : kind === "company" ? companies.byId.get(id)?.name : ownProjects.byId.get(id)?.name;
    return name ? { key: focusKey, kind, id, name } : null;
  }, [focusKey, kind, id, aside, detail.data, companies.byId, ownProjects.byId]);

  const base = useMemo(
    () => (focus && aside ? withStageEvents(feed.items, focus, stageEvents.data, feed.opps.byId, feed.projects.byId) : feed.items),
    [feed.items, feed.opps.byId, feed.projects.byId, focus, aside, stageEvents.data],
  );
  const counts = useMemo(() => dayCounts(base), [base]);
  const week = useMemo(() => weekStats(feed.items), [feed.items]);
  const shown = useMemo(() => filterFeed(base, { actor, hidden, focus: focusKey, q: dq }), [base, actor, hidden, focusKey, dq]);
  const focusRows = useMemo(() => (focusKey ? base.filter((i) => i.refs.includes(focusKey)) : []), [base, focusKey]);

  const viewKey = `${actor}|${[...hidden].join()}|${focusKey}|${dq}`;
  const limit = pg.key === viewKey ? pg.n : TL_PAGE;
  const days = useMemo(() => groupDays(shown.slice(0, limit), counts), [shown, limit, counts]);

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

  if (feed.error) return frame(<ErrorBox error={feed.error} retry={feed.reload} />);
  if (aside && detail.error && !detail.data) return frame(<ErrorBox error={detail.error} retry={detail.reload} />);
  const lookedUp = aside ? !!detail.data : kind === "company" ? !!companies.data : kind === "own_project" ? !!ownProjects.data : true;
  if (focusKey && !focus && lookedUp) return frame(<Empty>Kayıt bulunamadı</Empty>);
  if (!feed.ready || (focusKey && !focus)) return frame(<PageSkeleton />);

  const openThread = aside ? feed.threads.find((t) => t.target_type === aside && t.target_id === id && !t.resolved_at) : undefined;
  const list = (
    <div className="tlx-feed rise" style={order(3)}>
      <FeedFilters actor={actor} onActor={setActor} hidden={hidden} onToggle={toggle} />
      <DayGroups days={days} onFocus={onFocus} />
      {shown.length === 0 ? <p className="tlx-empty">Bu süzgeçte olay yok.</p> : null}
      {shown.length > limit ? <button type="button" className="tlx-more" onClick={() => setPg({ key: viewKey, n: limit + TL_PAGE })}>Daha eski olaylar</button> : null}
      {aside && focus ? <div className="tlx-composer"><FeedComposer type={aside} id={id} label={focus.name} openThread={openThread} /></div> : null}
    </div>
  );

  return frame(
    <>
      {focus ? <FocusCard rec={focus} summary={focusSummary(focusRows, stageEvents.data?.[0]?.created_at)} onClear={() => navigate(PATHS.timeline)} /> : null}
      <WeekStrip week={week} className="rise" style={order(2)} />
      {aside && detail.data ? (
        <div className="tlx-with-aside">
          {list}
          <RecordAside key={focusKey} type={aside} id={id} detail={detail.data} touches={feed.touches} />
        </div>
      ) : list}
    </>,
  );
}
