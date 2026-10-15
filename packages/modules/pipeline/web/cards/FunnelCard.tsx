import { useMemo } from "react";
import { Link } from "wouter";
import { useBoard } from "@kit/api/keys";
import { isMissing } from "@kit/api/modules";
import { useQuery } from "@kit/api/store";
import type { Opportunity, Report } from "@kit/api/types";
import { initials, lira, pct } from "@kit/lib/format";
import { OPEN_STAGES, STAGE } from "@kit/lib/labels";
import { BOARD_STAGES, STAGE_BG } from "../labels";
import { BoardIcon } from "@kit/components/boardIcons";
import { opportunityPath, PIPELINE_PATH } from "../paths";
import { Card, Meter } from "@kit/components/ui";
import { useExpand } from "@kit/components/ExpandOverlay";
import { DashOverlay, type ExRow } from "@kit/components/dash/DashOverlay";
import { m } from "../messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** Source pills in the funnel card */
const FUNNEL_SOURCES = 3;

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
  if (isMissing(board.error)) return null;

  const total = BOARD_STAGES.reduce((s, k) => s + (counts.get(k) ?? 0), 0);
  const value = open.reduce((s, o) => s + (o.estimated_value ?? 0), 0);
  const won = report.data?.sources.reduce((s, r) => s + r.won, 0) ?? 0;
  const lost = report.data?.sources.reduce((s, r) => s + r.lost, 0) ?? 0;
  const tail = m.funnelCard.open(won + lost ? pct(won / (won + lost)) : null);
  const rows: ExRow[] = open.slice(0, OVERLAY_ROWS).map((o) => ({
    key: o.id, lead: initials(o.person_name), title: o.person_name, sub: o.title, right: o.estimated_value ? lira(o.estimated_value) : "", tag: STAGE[o.stage], dot: STAGE_BG[o.stage], href: opportunityPath(o.id),
  }));

  return (
    <>
      <Card label={m.funnelCard.title} className="dash-gap-8 rise">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="ff-card-title">{m.funnelCard.title}</h2>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl leading-none tracking-kpi">{lira(value)}</span>
              <span className="text-base-sm text-text-secondary">{tail}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {sources.map(([name, n]) => <span key={name} className="dash-chip is-pill">{name} {n}</span>)}
            <button type="button" className="ff-more" aria-label={m.funnelCard.expand} onClick={(e) => ex.show("funnel", e.currentTarget.closest("section")!.getBoundingClientRect())}>
              {m.funnelCard.count(total)}
              <span className="ff-more-ic"><BoardIcon name="expand" className="size-icon-chip" stroke={STROKE.medium} /></span>
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-5">
          {BOARD_STAGES.map((s) => {
            const n = counts.get(s) ?? 0;
            return (
              <Link key={s} href={PIPELINE_PATH} className="dash-funnel-row dash-row">
                <span className="flex items-center gap-3 text-base-sm text-text-neutral-chip"><span className={`dash-dot ${STAGE_BG[s]}`} />{STAGE[s]}</span>
                <Meter value={(n / max) * PERCENT} className="dash-funnel-bar" color={s === "kazanildi" ? "bg-accent" : "bg-border-strong"} label={`${STAGE[s]} ${n}`} />
                <span className="text-right font-mono text-md">{n}</span>
              </Link>
            );
          })}
        </div>
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: m.funnelCard.title, sub: `${lira(value)} ${tail}`, page: m.funnelCard.pageName, href: PIPELINE_PATH, foot: open.length > OVERLAY_ROWS ? m.funnelCard.more(open.length - OVERLAY_ROWS) : m.funnelCard.openCount(open.length), rows }} />
    </>
  );
}
