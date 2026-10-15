import { SEGMENT_FILTERS, SORTS, type SegmentFilter, type SortKey } from "../companies";
import { MoreFilters, type LabelFilter } from "@kit/components/filters";
import { Filters } from "@kit/components/ui";
import { m } from "../messages";

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
      <Filters label={m.filters.type} items={SEGMENT_FILTERS.map((s) => ({ value: s.key, label: s.label, count: counts[s.key] }))} value={seg} onChange={onSeg} />
      <span className="flex-grow" />
      <MoreFilters value={labels} onChange={onLabels} />
      <span className="co-sort-label">{m.filters.sort}</span>
      <Filters label={m.filters.sorting} items={SORTS.map((s) => ({ value: s.key, label: s.label }))} value={sort} onChange={onSort} />
    </div>
  );
}
