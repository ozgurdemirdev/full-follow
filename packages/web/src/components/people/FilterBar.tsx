import { CHANNELS, FILTERS, type PStatus } from "../../lib/people";
import { usePopover } from "../../lib/usePopover";
import { BoardIcon } from "../boardIcons";
import { LabelFilters, noFilter, type LabelFilter } from "../filters";

export type StatusFilter = "all" | Exclude<PStatus, "ok">;
const TONE_STATUS: Record<string, PStatus | undefined> = { all: undefined, due: "due", wait: "wait", cold: "cold", fresh: "fresh" };

/** The tag, sector, source and status filters of the old page, behind one pill */
function MoreFilters({ value, onChange }: { value: LabelFilter; onChange: (v: LabelFilter) => void }) {
  const { open, setOpen, root } = usePopover();
  const active = Object.values(value).filter(Boolean).length;
  return (
    <div ref={root} className="relative">
      <button type="button" className="ppl-chan ppl-filter" data-on={active > 0} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Süzgeç{active ? ` · ${active}` : ""}
      </button>
      <div role="dialog" aria-label="Süzgeç" aria-hidden={!open} className="ppl-pop" inert={!open}>
        <LabelFilters value={value} onChange={onChange} />
        {active ? <button type="button" className="ppl-pop-item" onClick={() => onChange(noFilter)}>Süzgeci temizle</button> : null}
      </div>
    </div>
  );
}

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
