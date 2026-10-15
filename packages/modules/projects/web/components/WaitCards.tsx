import type { CSSProperties } from "react";
import type { WaitKey } from "../types";
import { lira } from "@kit/lib/format";
import { m } from "../messages";
import { WAIT_CARDS, type ProjectView, summarize } from "../projects";

/** "Bekleyen para": what each wait holds; a card is a filter for the list below. Müşteride shows only when the client owns work. */
export function WaitCards({ views, who, onPick, showClient }: { views: ProjectView[]; who: WaitKey | null; onPick: (k: WaitKey | null) => void; showClient: boolean }) {
  const sums = summarize(views);
  const cards = WAIT_CARDS.filter((c) => c.key !== "client" || showClient);
  return (
    <section aria-label={m.wait.money} className="prj-waits" style={{ "--prj-n": cards.length } as CSSProperties}>
      {cards.map((c) => (
        <button key={c.key} type="button" data-w={c.key} className="prj-wait" aria-pressed={who === c.key} onClick={() => onPick(who === c.key ? null : c.key)}>
          <span className="prj-wait-name"><span className="prj-wait-dot" />{c.label}</span>
          <span className="prj-wait-val">{lira(sums[c.key].money)}</span>
          <span className="prj-wait-sub">{m.wait.projects(sums[c.key].count, c.sub)}</span>
        </button>
      ))}
    </section>
  );
}
