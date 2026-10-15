import type { OwnProject, OwnStage } from "@kit/api/types";
import { SELLABLE } from "@kit/lib/labels";
import { JOURNEY, journeyState, SELLABLE_CLS, stageLabel } from "../ownProjects";
import { BOARD_ICON } from "@kit/components/boardIcons";

/** Filled star of the focus chip and button */
export function StarIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={BOARD_ICON.star} />
    </svg>
  );
}

/** "Satılabilir" / "Belki satılır" / "Satılmaz" */
export function SellChip({ p, size, className = "" }: { p: OwnProject; size?: "sm" | "md"; className?: string }) {
  return <span className={`opr-chip ${SELLABLE_CLS[p.sellable]} ${className}`} data-size={size}>{SELLABLE[p.sellable]}</span>;
}

/**
 * Journey bars Fikir, Doğrulama, Demo, Ürün: done, current (glowing), hatched next. A project without a stage shows every step ahead;
 * with `onPick` a click on a step sets the stage (the card variant has no labels and is read only).
 */
export function Journey({ stage, variant, onPick }: { stage: OwnStage | null; variant: "hero" | "card" | "ex"; onPick?: (step: OwnStage) => void }) {
  const bars = variant === "card";
  return (
    <div className="opr-journey" data-v={variant} role="group" aria-label={stage ? `Aşama: ${stageLabel(stage)}` : "Aşama seçilmedi"}>
      {JOURNEY.map((j) => {
        const state = journeyState(stage, j.key);
        const inner = (
          <>
            <span className="opr-jbar" data-j={state} />
            {bars ? null : <span className="opr-jlabel" data-j={state}>{j.label}</span>}
          </>
        );
        return onPick && !bars ? (
          <button key={j.key} type="button" className="opr-jstep" aria-pressed={state === "now"} aria-label={`Aşama: ${j.label}`} onClick={() => onPick(j.key)}>{inner}</button>
        ) : (
          <div key={j.key} className="opr-jstep">{inner}</div>
        );
      })}
    </div>
  );
}
