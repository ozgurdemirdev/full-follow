import { memo } from "react";
import type { IdeaRow } from "../../api/types";
import { dotsOf, LANE_RATE_GOOD, rateOf, ratePct, type Lane } from "../../lib/ideas";
import { IDEA_STAGE } from "../../lib/labels";

const LaneCard = memo(function LaneCard({ idea, on, onPick }: { idea: IdeaRow; on: boolean; onPick: (id: number) => void }) {
  const rate = rateOf(idea);
  return (
    <button type="button" className="ideas-card" aria-pressed={on} data-record={`idea-${idea.id}`} onClick={() => onPick(idea.id)}>
      <span className="ideas-card-title">{idea.title}</span>
      <span className="ideas-dots">
        {dotsOf(idea).map((r, n) => <span key={n} className="ideas-dot" data-r={r} />)}
        <span className="ideas-rate" data-tone={rate === null ? "none" : rate >= LANE_RATE_GOOD ? "good" : undefined}>
          {rate === null ? "cevap yok" : `%${ratePct(rate)}`}
        </span>
      </span>
    </button>
  );
});

/** The four stage lanes: each card shows one dot per person told and the interest rate */
export function IdeaLanes({ lanes, selId, onPick }: { lanes: Lane[]; selId: number | undefined; onPick: (id: number) => void }) {
  return (
    <section aria-label="Aşamalar" className="ideas-lanes">
      {lanes.map((l) => (
        <div key={l.stage} className="ideas-lane" data-lane={l.stage}>
          <div className="ideas-lane-head">
            <i />
            <b>{IDEA_STAGE[l.stage]}</b>
            <span>{l.ideas.length}</span>
          </div>
          {l.ideas.map((i) => <LaneCard key={i.id} idea={i} on={i.id === selId} onPick={onPick} />)}
        </div>
      ))}
    </section>
  );
}
