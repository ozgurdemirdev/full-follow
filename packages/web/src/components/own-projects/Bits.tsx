import type { OwnRow, OwnStage } from "../../api/types";
import { SELLABLE } from "../../lib/labels";
import { JOURNEY, journeyState, SELLABLE_CLS, stageLabel } from "../../lib/ownProjects";
import { BOARD_ICON } from "../boardIcons";

/** Filled star of the focus chip and button */
export function StarIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={BOARD_ICON.star} />
    </svg>
  );
}

/** "Satılabilir" / "Belki satılır" / "Satılmaz" */
export function SellChip({ p, size, className = "" }: { p: OwnRow; size?: "sm" | "md"; className?: string }) {
  return <span className={`opr-chip ${SELLABLE_CLS[p.sellable]} ${className}`} data-size={size}>{SELLABLE[p.sellable]}</span>;
}

/**
 * Journey bars Fikir, Doğrulama, Demo, Ürün: done, current (glowing), hatched next.
 * Renders nothing until the project has a stage (gap G15).
 */
export function Journey({ stage, variant }: { stage?: OwnStage | null; variant: "hero" | "card" | "ex" }) {
  if (!stage) return null;
  const bars = variant === "card";
  return (
    <div className="opr-journey" data-v={variant} role="group" aria-label={`Aşama: ${stageLabel(stage)}`}>
      {JOURNEY.map((j) => {
        const state = journeyState(stage, j.key);
        return (
          <div key={j.key} className="opr-jstep">
            <span className="opr-jbar" data-j={state} />
            {bars ? null : <span className="opr-jlabel" data-j={state}>{j.label}</span>}
          </div>
        );
      })}
    </div>
  );
}
