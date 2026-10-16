import { useCallback, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { qs } from "@kit/api/client";
import { usePaged } from "@kit/api/paged";
import { useQuery } from "@kit/api/store";
import type { CompaniesOverview, CompanyOverviewRow, CompanyTotals } from "@kit/api/types";
import { Page } from "@kit/app/Page";
import { Slot } from "@kit/app/modules/Slot";
import { openSheet } from "@kit/app/ui";
import { AddButton } from "@kit/components/AddButton";
import { BoardIcon } from "@kit/components/boardIcons";
import { CompanyOverlay } from "../components/CompanyOverlay";
import { CompanyTile } from "../components/CompanyTile";
import { FilterBar } from "../components/FilterBar";
import { Kpis } from "../components/Kpis";
import { LoadMore } from "@kit/components/LoadMore";
import { noFilter, type LabelFilter } from "@kit/components/filters";
import { TileColumns } from "@kit/components/layout";
import { ErrorBox, PageSkeleton } from "@kit/components/ui";
import { COMPANIES_PATH } from "../paths";
import { TILE_PAGE, viewOf, type SegmentFilter, type SortKey } from "../companies";
import { ONE_ROW, SEARCH_DEBOUNCE_MS } from "@kit/lib/constants";
import { useDebounced } from "@kit/lib/useDebounced";
import { m as kit } from "@kit/messages";

import { m } from "../messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

const OVERVIEW = "/companies/overview";
const TOTALS = "/companies/totals";
const ZERO_COUNTS: Record<SegmentFilter, number> = { all: 0, client: 0, lead: 0, partner: 0 };

/** Size of the box the overlay grows from when a company is opened by address, not by a click */
const FALLBACK_BOX = { width: 240, height: 140 };
const fallbackRect = () => new DOMRect((innerWidth - FALLBACK_BOX.width) / 2, (innerHeight - FALLBACK_BOX.height) / 2, FALLBACK_BOX.width, FALLBACK_BOX.height);

/** Companies: the KPI row, segment and sort pills, the tiles, the loose touches and the company overlay (the address /firmalar/:id opens it) */
export default function Companies() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [seg, setSeg] = useState<SegmentFilter>("all");
  const [sort, setSort] = useState<SortKey>("value");
  const [labels, setLabels] = useState<LabelFilter>(noFilter);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState<DOMRect | null>(null);
  const openId = Number(params.id) || null;

  // filters, segment, sort and search go to the server; the tiles come a page at a time as the end is scrolled into view
  const search = useDebounced(q.trim(), SEARCH_DEBOUNCE_MS);
  const list = usePaged<CompanyOverviewRow, Pick<CompaniesOverview, "counts">>(
    `${OVERVIEW}${qs({ q: search, segment: seg === "all" ? undefined : seg, sort, ...labels })}`,
    TILE_PAGE,
  );
  const totals = useQuery<CompanyTotals>(TOTALS);
  const views = useMemo(() => list.rows.map(viewOf), [list.rows]);
  const max = Math.max(1, totals.data?.top_worth ?? 0);
  const counts: Record<SegmentFilter, number> = list.extra?.counts ?? ZERO_COUNTS;
  // a company opened by address that is not on a loaded page is read by its id
  const loaded = openId ? views.find((v) => v.c.id === openId) : undefined;
  const byAddress = useQuery<{ rows: CompanyOverviewRow[] }>(openId && !loaded ? `${OVERVIEW}${qs({ ids: openId, limit: ONE_ROW })}` : null);
  const openView = useMemo(() => loaded ?? (byAddress.data?.rows[0] ? viewOf(byAddress.data.rows[0]) : undefined), [loaded, byAddress.data]);

  const open = useCallback((id: number, el: HTMLElement) => {
    setFrom(el.getBoundingClientRect());
    navigate(`${COMPANIES_PATH}/${id}`, { replace: true });
  }, [navigate]);
  const started = (list.rows.length > 0 || !list.pending) && !!totals.data;

  return (
    <Page
      title={kit.nouns.companies}
      sub={m.page.sub}
      className="flex flex-col gap-10"
      right={
        <div className="ppl-tools">
          <label className="ppl-search co-search">
            <BoardIcon name="search" className="size-icon-md" stroke={STROKE.thin} />
            <span className="sr-only">{m.page.searchLabel}</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.page.searchPlaceholder} />
          </label>
          <AddButton label={m.page.add} onClick={() => openSheet("company")} />
        </div>
      }
    >
      {list.error && !list.rows.length ? <ErrorBox error={list.error} retry={list.reload} /> : null}
      {!started ? (
        !list.error && <PageSkeleton />
      ) : (
        <>
          {totals.data ? <Kpis t={totals.data} /> : null}
          <FilterBar seg={seg} onSeg={setSeg} counts={counts} labels={labels} onLabels={setLabels} sort={sort} onSort={setSort} />
          <TileColumns>
            {views.map((v) => <CompanyTile key={v.c.id} v={v} max={max} onOpen={open} />)}
          </TileColumns>
          {views.length === 0 && !list.pending ? <p className="co-empty">{m.page.empty}</p> : null}
          <LoadMore hasMore={list.hasMore} loaded={views.length} onMore={list.loadMore} />
          {list.hasMore ? (
            <button type="button" className="co-btn co-more" onClick={list.loadMore}>{m.page.showMore(list.total - views.length)}</button>
          ) : null}
          <Slot name="companies.page.after" />
          <CompanyOverlay id={openId} from={openId ? (from ?? fallbackRect()) : from} v={openView} max={max}
            onClose={() => navigate(COMPANIES_PATH, { replace: true })} />
        </>
      )}
    </Page>
  );
}
