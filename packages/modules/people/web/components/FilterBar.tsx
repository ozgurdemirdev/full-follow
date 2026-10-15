import { CHANNELS, type PStatus } from "@kit/lib/people";
import { FILTERS } from "../people";
import { BoardIcon } from "@kit/components/boardIcons";
import { MoreFilters, type LabelFilter } from "@kit/components/filters";

export type StatusFilter = "all" | Exclude<PStatus, "ok">;
const TONE_STATUS: Record<string, PStatus | undefined> = { all: undefined, due: "due", wait: "wait", cold: "cold", fresh: "fresh" };

/** Status pills with counts, channel pills and the filter menu */
export function FilterBar({ status, onStatus, counts, chan, onChan, labels, onLabels }: {
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
  chan: string | null;
  onChan: (c: string | null) => void;
  labels: LabelFilter;
  onLabels: (v: LabelFilter) => void;
}) {
  return (
    <div className="ppl-bar">
      <div className="ppl-pills" role="radiogroup" aria-label="Durum">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="radio" className="ppl-pill" data-s={TONE_STATUS[f.key]} aria-checked={status === f.key} onClick={() => onStatus(f.key)}>
            {TONE_STATUS[f.key] ? <i /> : null}
            {f.label}
            <b>{counts[f.key]}</b>
          </button>
        ))}
      </div>
      <span className="flex-grow" />
      <MoreFilters value={labels} onChange={onLabels} />
      <div className="ppl-chans" role="group" aria-label="Kanal">
        {CHANNELS.map((c) => (
          <button key={c.key} type="button" className="ppl-chan" aria-pressed={chan === c.key} aria-label={c.label} title={c.label} onClick={() => onChan(chan === c.key ? null : c.key)}>
            <BoardIcon name={c.icon} className="size-icon-chip" />
          </button>
        ))}
      </div>
    </div>
  );
}
