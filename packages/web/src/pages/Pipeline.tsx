import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { pickable,useBoard, useOpenTasks, useOpps, useSources, useThreads } from "../api/keys";
import { useQuery } from "../api/store";
import type { Report, SourceFunnel } from "../api/types";
import { Page } from "../app/Page";
import { openSheet } from "../app/ui";
import { BoardIcon } from "../components/boardIcons";
import { Board, scrollToStage } from "../components/pipeline/Board";
import { LostReasons, SourceWins } from "../components/pipeline/Breakdowns";
import { Kpis } from "../components/pipeline/Kpis";
import { StageFunnel } from "../components/pipeline/StageFunnel";
import { ErrorBox, Filters, PageSkeleton } from "../components/ui";
import { lira, norm } from "../lib/format";
import { useIsDesktop } from "../lib/media";
import { BOARD_STAGES, type OppStage } from "../lib/labels";
import { hintsByOpportunity, nextSteps, pipelineStats, stageRates } from "../lib/pipeline";

const ALL_STAGES: OppStage[] = [...BOARD_STAGES, "kaybedildi"];
/** Window of the stage to stage rates (days); the source funnel endpoint takes it as `period` */
const RATE_DAYS = 90;

/** Satış hunisi: forecast, where deals are lost, the kanban board, lost reasons and sources */
export default function Pipeline() {
  const board = useBoard();
  const all = useOpps();
  const sources = useSources();
  const threads = useThreads();
  const tasks = useOpenTasks();
  const report = useQuery<Report>("/report");
  const funnel = useQuery<SourceFunnel>(`/report/sources?period=${RATE_DAYS}`);
  const desk = useIsDesktop();
  const [src, setSrc] = useState(0);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [hideLost, setHideLost] = useState(false);
  const [exp, setExp] = useState<number | null>(null);
  const onToggle = useCallback((id: number) => setExp((cur) => (cur === id ? null : id)), []);

  const visible = useMemo(() => {
    const n = norm(dq.trim());
    return board.rows.filter((o) => (!src || o.source_id === src) && (!n || [o.title, o.person_name, o.company_name].some((x) => norm(x).includes(n))));
  }, [board.rows, src, dq]);
  const stats = useMemo(() => pipelineStats(board.rows), [board.rows]);
  const rates = useMemo(() => stageRates(funnel.data), [funnel.data]);
  const hints = useMemo(() => hintsByOpportunity(threads.rows), [threads.rows]);
  const nexts = useMemo(() => nextSteps(board.rows, tasks.rows), [board.rows, tasks.rows]);
  const stages = hideLost ? BOARD_STAGES : ALL_STAGES;
  const sub = board.data ? `${stats.open} açık fırsat · ${lira(stats.openValue)}${desk ? " · kartları sürükleyerek aşama değiştir" : ""}` : "";

  return (
    <Page
      title="Satış hunisi"
      sub={sub}
      className="flex flex-col gap-10"
      right={
        <div className="pipe-tools">
          <label className="ppl-search pipe-search">
            <BoardIcon name="search" className="size-icon-md" stroke={1.8} />
            <span className="sr-only">Fırsat ara</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fırsat ara" />
          </label>
          <button type="button" className="pipe-toggle" aria-pressed={hideLost} onClick={() => setHideLost((v) => !v)}>
            {hideLost ? "Kaybedilenleri göster" : "Kaybedilenleri gizle"}
          </button>
          <button type="button" className="dash-new" onClick={() => openSheet("opportunity")}>
            <BoardIcon name="plus" className="size-icon-md" stroke={2.2} />
            Fırsat ekle
          </button>
        </div>
      }
    >
      {board.error && !board.data ? <ErrorBox error={board.error} retry={board.reload} /> : null}
      {!board.data ? (
        !board.error && <PageSkeleton />
      ) : (
        <>
          <Kpis stats={stats} floor={report.data?.month.floor ?? 0} />
          <StageFunnel rows={board.rows} rates={rates} onPick={scrollToStage} />
          <div className="flex flex-col gap-7">
            <div className="pipe-sources">
              <span className="text-base-sm text-text-secondary">Kaynak</span>
              <Filters label="Kaynak" value={src} onChange={setSrc} items={[{ value: 0, label: "Tümü" }, ...pickable(sources.rows).map((s) => ({ value: s.id, label: s.name }))]} />
            </div>
            <Board visible={visible} all={board.rows} byId={board.byId} stages={stages} desk={desk} exp={exp} hints={hints} nexts={nexts} onToggle={onToggle} />
          </div>
          <div className="pipe-below">
            <LostReasons rows={all.rows} />
            <SourceWins sources={report.data?.sources ?? []} />
          </div>
        </>
      )}
    </Page>
  );
}
