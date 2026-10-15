import { AnimatePresence } from "motion/react";
import { useState } from "react";
import type { Draft, Person } from "@kit/api/types";
import { STACK, draftKind, type DraftResult } from "../drafts";
import { BoardIcon } from "@kit/components/boardIcons";
import { DraftCard } from "./DraftCard";
import { DraftSide } from "./DraftSide";

export interface Handled {
  id: number;
  result: DraftResult;
}

/** One dot per draft of this visit: done ones coloured by result, the current one wide */
function Dots({ handled, pending }: { handled: Handled[]; pending: Draft[] }) {
  return (
    <span className="drf-dots">
      {handled.map((h) => <span key={h.id} className="drf-dot" data-state={h.result} />)}
      {pending.map((d, i) => <span key={d.id} className="drf-dot" data-state={i === 0 ? "current" : "todo"} />)}
    </span>
  );
}

/** The approval queue: progress, the card stack (next two drafts peek out behind) and the side context */
export function DraftReview({ pending, handled, onHandled, personOf, rules }: {
  pending: Draft[];
  handled: Handled[];
  onHandled: (h: Handled) => void;
  personOf: (id: number | null) => Person | undefined;
  rules: string[];
}) {
  const [dir, setDir] = useState<DraftResult>("sent");
  const cur = pending[0];
  const total = handled.length + pending.length;

  return (
    <div className="drf-review">
      <div className="drf-main">
        {cur ? (
          <div className="drf-progress">
            <span className="flex-grow">{handled.length + 1} / {total} · {draftKind(cur)}</span>
            <Dots handled={handled} pending={pending} />
          </div>
        ) : null}
        <div className="drf-stack" data-done={!cur}>
          {pending.length > 2 ? <div className="drf-peek" aria-hidden="true" style={peekStyle(1)} /> : null}
          {pending.length > 1 ? <div className="drf-peek" data-near aria-hidden="true" style={peekStyle(0)} /> : null}
          <AnimatePresence mode="wait" custom={dir}>
            {cur ? (
              <DraftCard key={cur.id} d={cur} person={personOf(cur.person_id)} onResult={(result) => { setDir(result); onHandled({ id: cur.id, result }); }} />
            ) : (
              <div key="done" className="drf-done">
                <span className="drf-done-mark"><BoardIcon name="check" className="size-icon-2xl" stroke={2.4} /></span>
                <span className="drf-done-title">Bekleyen taslak kalmadı</span>
                <span className="text-base text-text-secondary">Kişi ya da fırsat kartından Claude’dan yeni taslak isteyebilirsin.</span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {cur ? <DraftSide d={cur} person={personOf(cur.person_id)} rules={rules} /> : null}
    </div>
  );
}

const peekStyle = (i: number) => {
  const p = STACK.peeks[i];
  return { transform: `translateY(${p.y}px) scale(${p.scale})`, opacity: p.opacity };
};
