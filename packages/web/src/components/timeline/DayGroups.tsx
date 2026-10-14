import { memo } from "react";
import type { TlItem, TlRec } from "../../api/types";
import { lira } from "../../lib/format";
import { fmtClock, recKind, recTone, TL_TYPE, type TlDay } from "../../lib/timeline";
import { PathIcon } from "./PathIcon";

const Row = memo(function Row({ e, onFocus }: { e: TlItem; onFocus: (r: TlRec) => void }) {
  const type = TL_TYPE[e.type];
  const rec = e.rec;
  return (
    <div className="tlx-ev" data-tlt={e.type}>
      <span className="tlx-ev-icon"><PathIcon d={type.icon} /></span>
      <div className="tlx-ev-body">
        <span className="tlx-meta">
          {e.timed ? <span className="tlx-time">{fmtClock(e.at)}</span> : null}
          <span className="tlx-actor" data-by={e.by}>{e.by === "ozgur" ? "Sen" : "Claude"}</span>
          <span>{type.label}</span>
        </span>
        <span className="tlx-text">{e.text}</span>
        {rec || e.amount ? (
          <span className="tlx-chips">
            {rec && recKind(rec.kind).focus ? (
              <button type="button" className="tlx-chip" data-rec={recTone(rec.kind)} onClick={() => onFocus(rec)}>
                <span className="tlx-dot" />{rec.name}
              </button>
            ) : rec ? (
              <span className="tlx-chip" data-rec={recTone(rec.kind)}><span className="tlx-dot" />{rec.name}</span>
            ) : null}
            {e.amount ? <span className="tlx-amount">{lira(e.amount)}</span> : null}
          </span>
        ) : null}
      </div>
    </div>
  );
});

/** Day sections, each a card of event rows (time, actor chip, type, text, record chip, amount) */
export const DayGroups = memo(function DayGroups({ days, onFocus }: { days: TlDay[]; onFocus: (r: TlRec) => void }) {
  return (
    <>
      {days.map((d) => (
        <section key={d.key} aria-label={d.title} className="tlx-day">
          <div className="tlx-day-head">
            <h2 className="tlx-day-title">{d.title}</h2>
            <span className="tlx-day-sum">{d.sum}</span>
          </div>
          <div className="tlx-events">
            {d.events.map((e) => <Row key={e.key} e={e} onFocus={onFocus} />)}
          </div>
        </section>
      ))}
    </>
  );
});
