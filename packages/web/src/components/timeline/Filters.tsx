import type { TlType } from "../../api/types";
import type { Actor } from "../../lib/labels";
import { ACTOR_PILLS, TL_TYPES } from "../../lib/timeline";
import { Filters } from "../ui";

/** Who did it (Hepsi, Sen, Claude) and the event type toggles */
export function FeedFilters({ actor, onActor, hidden, onToggle }: {
  actor: "all" | Actor;
  onActor: (a: "all" | Actor) => void;
  hidden: ReadonlySet<TlType>;
  onToggle: (t: TlType) => void;
}) {
  return (
    <div className="tlx-filters">
      <Filters label="Kim yaptı" items={ACTOR_PILLS} value={actor} onChange={onActor} />
      {TL_TYPES.map((t) => (
        <button key={t.key} type="button" className="tlx-type" data-tlt={t.key} aria-pressed={!hidden.has(t.key)} onClick={() => onToggle(t.key)}>
          <span className="tlx-dot" />{t.label}
        </button>
      ))}
    </div>
  );
}
