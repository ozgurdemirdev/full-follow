import { useMemo } from "react";
import { Link } from "wouter";
import { useBoard } from "../../api/keys";
import { useQuery } from "../../api/store";
import type { Opportunity, Report } from "../../api/types";
import { opportunityPath, PATHS } from "../../app/routes";
import { FUNNEL_SOURCES } from "../../lib/dashboard";
import { initials, lira, pct } from "../../lib/format";
import { BOARD_STAGES, OPEN_STAGES, STAGE, STAGE_BG } from "../../lib/labels";
import { BoardIcon } from "../boardIcons";
import { Card, Meter } from "../ui";
import { useExpand } from "../ExpandOverlay";
import { DashOverlay, type ExRow } from "./DashOverlay";

/** Rows of the overlay: the biggest open opportunities first */
const OVERLAY_ROWS = 12;
const PERCENT = 100;

/** "Satış hunisi": open value, win rate, the biggest open sources and a bar per stage */
export function FunnelCard() {
  const ex = useExpand();
  const board = useBoard();
  const report = useQuery<Report>("/report");
  const { counts, open, sources, max } = useMemo(() => {
    const count = new Map<string, number>();
    const src = new Map<string, number>();
    const openRows: Opportunity[] = [];
    for (const o of board.rows) {
      count.set(o.stage, (count.get(o.stage) ?? 0) + 1);
      if (OPEN_STAGES.includes(o.stage)) {
        openRows.push(o);
        src.set(o.source_name, (src.get(o.source_name) ?? 0) + 1);
      }
    }
    return {
      counts: count,
      open: openRows.sort((a, b) => (b.estimated_value ?? 0) - (a.estimated_value ?? 0)),
      sources: [...src.entries()].sort((a, b) => b[1] - a[1]).slice(0, FUNNEL_SOURCES),
      max: Math.max(1, ...BOARD_STAGES.map((s) => count.get(s) ?? 0)),
    };
  }, [board.rows]);

  const total = BOARD_STAGES.reduce((s, k) => s + (counts.get(k) ?? 0), 0);
  const value = open.reduce((s, o) => s + (o.estimated_value ?? 0), 0);
  const won = report.data?.sources.reduce((s, r) => s + r.won, 0) ?? 0;
  const lost = report.data?.sources.reduce((s, r) => s + r.lost, 0) ?? 0;
  const tail = `açık fırsat${won + lost ? ` · kazanma oranı ${pct(won / (won + lost))}` : ""}`;
  const rows: ExRow[] = open.slice(0, OVERLAY_ROWS).map((o) => ({
    key: o.id, lead: initials(o.person_name), title: o.person_name, sub: o.title, right: o.estimated_value ? lira(o.estimated_value) : "", tag: STAGE[o.stage], dot: STAGE_BG[o.stage], href: opportunityPath(o.id),
  }));

  return (
    <>
      <Card label="Satış hunisi" className="dash-gap-8 rise">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="ff-card-title">Satış hunisi</h2>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl leading-none tracking-kpi">{lira(value)}</span>
              <span className="text-base-sm text-text-secondary">{tail}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {sources.map(([name, n]) => <span key={name} className="dash-chip is-pill">{name} {n}</span>)}
            <button type="button" className="ff-more" aria-label="Satış hunisi, büyüt" onClick={(e) => ex.show("funnel", e.currentTarget.closest("section")!.getBoundingClientRect())}>
              {total} fırsat
              <span className="ff-more-ic"><BoardIcon name="expand" className="size-icon-chip" stroke={2.2} /></span>
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-5">
          {BOARD_STAGES.map((s) => {
            const n = counts.get(s) ?? 0;
            return (
              <Link key={s} href={PATHS.pipeline} className="dash-funnel-row dash-row">
                <span className="flex items-center gap-3 text-base-sm text-text-neutral-chip"><span className={`dash-dot ${STAGE_BG[s]}`} />{STAGE[s]}</span>
                <Meter value={(n / max) * PERCENT} className="dash-funnel-bar" color={s === "kazanildi" ? "bg-accent" : "bg-border-strong"} label={`${STAGE[s]} ${n}`} />
                <span className="text-right font-mono text-md">{n}</span>
              </Link>
            );
          })}
        </div>
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: "Satış hunisi", sub: `${lira(value)} ${tail}`, page: "Satış hunisi", href: PATHS.pipeline, foot: open.length > OVERLAY_ROWS ? `ve ${open.length - OVERLAY_ROWS} fırsat daha` : `${open.length} açık fırsat`, rows }} />
    </>
  );
}
