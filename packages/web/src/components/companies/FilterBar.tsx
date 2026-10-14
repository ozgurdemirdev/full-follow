import { SEGMENT_FILTERS, SORTS, type SegmentFilter, type SortKey } from "../../lib/companies";
import type { LabelFilter } from "../filters";
import { MoreFilters } from "../people/FilterBar";
import { Filters } from "../ui";

/** Segment pills with counts, the filter menu (tag, sector, source, status) and the sort pills */
export function FilterBar({ seg, onSeg, counts, labels, onLabels, sort, onSort }: {
  seg: SegmentFilter;
  onSeg: (s: SegmentFilter) => void;
  counts: Record<SegmentFilter, number>;
  labels: LabelFilter;
  onLabels: (v: LabelFilter) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
}) {
  return (
    <div className="co-bar">
      <Filters label="Tür" items={SEGMENT_FILTERS.map((s) => ({ value: s.key, label: s.label, count: counts[s.key] }))} value={seg} onChange={onSeg} />
      <span className="flex-grow" />
      <MoreFilters value={labels} onChange={onLabels} />
      <span className="co-sort-label">Sırala</span>
      <Filters label="Sıralama" items={SORTS.map((s) => ({ value: s.key, label: s.label }))} value={sort} onChange={onSort} />
    </div>
  );
}
