import { useCallback, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useSectors } from "@kit/api/keys";
import { Page } from "@kit/app/Page";
import { Slot } from "@kit/app/modules/Slot";
import { openSheet } from "@kit/app/ui";
import { BoardIcon } from "@kit/components/boardIcons";
import { CompanyOverlay } from "../components/CompanyOverlay";
import { CompanyTile } from "../components/CompanyTile";
import { FilterBar } from "../components/FilterBar";
import { Kpis } from "../components/Kpis";
import { matchLabels, noFilter, type LabelFilter } from "@kit/components/filters";
import { TileColumns } from "@kit/components/layout";
import { ErrorBox, PageSkeleton } from "@kit/components/ui";
import { COMPANIES_PATH } from "../paths";
import { searchText, SORT, TILE_PAGE, totalsOf, useCompanyViews, type SegmentFilter, type SortKey } from "../companies";
import { norm } from "@kit/lib/format";

/** Size of the box the overlay grows from when a company is opened by address, not by a click */
const FALLBACK_BOX = { width: 240, height: 140 };
const fallbackRect = () => new DOMRect((innerWidth - FALLBACK_BOX.width) / 2, (innerHeight - FALLBACK_BOX.height) / 2, FALLBACK_BOX.width, FALLBACK_BOX.height);

/** Companies: the KPI row, segment and sort pills, the tiles, the loose touches and the company overlay (the address /firmalar/:id opens it) */
export default function Companies() {
  const { views, byId, companies, ready } = useCompanyViews();
  const sectors = useSectors();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [seg, setSeg] = useState<SegmentFilter>("all");
  const [sort, setSort] = useState<SortKey>("value");
  const [labels, setLabels] = useState<LabelFilter>(noFilter);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(TILE_PAGE);
  const [from, setFrom] = useState<DOMRect | null>(null);
  const openId = Number(params.id) || null;

  const totals = useMemo(() => totalsOf(views), [views]);
  const max = useMemo(() => Math.max(1, ...views.map((v) => v.total)), [views]);
  const base = useMemo(() => {
    const n = norm(q.trim());
    return views.filter((v) => matchLabels(v.c, labels, sectors.rows) && (!n || searchText(v).includes(n)));
  }, [views, sectors.rows, labels, q]);
  const counts = useMemo(() => {
    const c: Record<SegmentFilter, number> = { all: base.length, client: 0, lead: 0, partner: 0 };
    for (const v of base) c[v.segment]++;
    return c;
  }, [base]);
  const rows = useMemo(() => base.filter((v) => seg === "all" || v.segment === seg).sort(SORT[sort]), [base, seg, sort]);

  // any change of the list starts the incremental rendering over
  const reset = <T,>(set: (v: T) => void) => (v: T) => (set(v), setShown(TILE_PAGE));
  const open = useCallback((id: number, el: HTMLElement) => {
    setFrom(el.getBoundingClientRect());
    navigate(`${COMPANIES_PATH}/${id}`, { replace: true });
  }, [navigate]);

  return (
    <Page
      title="Firmalar"
      sub="Kimin içinde kimi tanıyorsun, firma sana ne kazandırdı"
      className="flex flex-col gap-10"
      right={
        <div className="ppl-tools">
          <label className="ppl-search co-search">
            <BoardIcon name="search" className="size-icon-md" stroke={1.8} />
            <span className="sr-only">Firma ara</span>
            <input type="search" value={q} onChange={(e) => reset(setQ)(e.target.value)} placeholder="Firma, sektör ya da şehir" />
          </label>
          <button type="button" className="dash-new" onClick={() => openSheet("company")}>
            <BoardIcon name="plus" className="size-icon-md" stroke={2.2} />
            Firma ekle
          </button>
        </div>
      }
    >
      {companies.error && !companies.data ? <ErrorBox error={companies.error} retry={companies.reload} /> : null}
      {!ready ? (
        !companies.error && <PageSkeleton />
      ) : (
        <>
          <Kpis t={totals} />
          <FilterBar seg={seg} onSeg={reset(setSeg)} counts={counts} labels={labels} onLabels={reset(setLabels)} sort={sort} onSort={reset(setSort)} />
          <TileColumns>
            {rows.slice(0, shown).map((v) => <CompanyTile key={v.c.id} v={v} max={max} onOpen={open} />)}
          </TileColumns>
          {rows.length === 0 ? <p className="co-empty">Bu süzgeçte firma yok.</p> : null}
          {rows.length > shown ? (
            <button type="button" className="co-btn co-more" onClick={() => setShown((n) => n + TILE_PAGE)}>{rows.length - shown} firma daha göster</button>
          ) : null}
          <Slot name="companies.page.after" />
          <CompanyOverlay id={openId} from={openId ? (from ?? fallbackRect()) : from} v={openId ? byId.get(openId) : undefined} max={max}
            onClose={() => navigate(COMPANIES_PATH, { replace: true })} />
        </>
      )}
    </Page>
  );
}
