import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useCallback, useMemo, useState, type ReactNode } from "react";
import { run } from "@kit/api/actions";
import { K } from "@kit/api/keys";
import { mutate } from "@kit/api/store";
import type { List, Opportunity } from "@kit/api/types";
import { openSheet } from "@kit/app/ui";
import { lira } from "@kit/lib/format";
import { STAGE, type OppStage } from "@kit/lib/labels";
import { BOARD_STAGES, STAGE_BG } from "../labels";
import { isLive, percentOf, useStageRules } from "../pipeline";
import { BoardIcon } from "@kit/components/boardIcons";
import { LostReason } from "./LostReason";
import { OppCard } from "./OppCard";

type Cols = Record<OppStage, number[]>;
const ALL_STAGES: OppStage[] = [...BOARD_STAGES, "kaybedildi"];
/** Ignore the click that follows a drag */
const CLICK_GUARD_MS = 250;
let lastDragEnd = 0;
/** Edge auto scroll: the pointer starts to pull the board at about 140px from its edge (a share of the board width) */
const AUTO_SCROLL = { threshold: { x: 0.11, y: 0.12 }, acceleration: 6 };
const ACTIVATE_DISTANCE = 6;
const TOUCH_DELAY_MS = 180;

const group = (rows: Opportunity[]): Cols => {
  const c = Object.fromEntries(ALL_STAGES.map((s) => [s, [] as number[]])) as Cols;
  for (const o of rows) c[o.stage]?.push(o.id);
  return c;
};

/** Bring a stage column into view (the funnel above the board uses it) */
export function scrollToStage(stage: OppStage) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(`col-${stage}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest", inline: "start" });
}

interface CardCtx {
  exp: number | null;
  hints: Map<number, string>;
  nexts: Map<number, string>;
  onToggle: (id: number) => void;
}

/** Column frame: dot, name, count, sum, then the cards */
function Shell({ stage, count, sum, hot, dragging, setRef, children }: {
  stage: OppStage; count: number; sum: number; hot?: boolean; dragging: boolean; setRef?: (el: HTMLElement | null) => void; children: ReactNode;
}) {
  const rules = useStageRules();
  return (
    <section ref={setRef} id={`col-${stage}`} aria-label={STAGE[stage]} className="pipe-col" data-hot={hot || undefined}>
      <div className="pipe-col-head">
        <span className={`dot ${STAGE_BG[stage]}`} />
        <h2 className="m-0 flex-grow text-base font-medium">{STAGE[stage]}</h2>
        <span className="font-mono text-sm text-text-secondary">{count}</span>
      </div>
      <span className="pipe-col-sum">{count ? `${lira(sum)}${isLive({ stage }) ? ` · ihtimal ${percentOf(stage, rules)}` : ""}` : "Boş"}</span>
      {children}
      {count ? null : <span className="pipe-col-empty">{dragging ? "Buraya bırak" : "Kart yok"}</span>}
      {stage !== "kazanildi" && stage !== "kaybedildi" ? (
        <button type="button" className="pipe-btn is-quiet" onClick={() => openSheet("opportunity", { stage })}>+ Fırsat ekle</button>
      ) : null}
    </section>
  );
}

const sumOf = (items: Opportunity[]) => items.reduce((a, o) => a + (o.estimated_value ?? 0), 0);

const SortableCard = memo(function SortableCard({ o, ctx }: { o: Opportunity; ctx: CardCtx }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: o.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "opacity-disabled" : ""}
      {...attributes}
      {...listeners}
      role="group"
      onClick={(e) => {
        if (Date.now() - lastDragEnd < CLICK_GUARD_MS || (e.target as HTMLElement).closest("a,button,select")) return;
        ctx.onToggle(o.id);
      }}
    >
      <OppCard o={o} open={ctx.exp === o.id} hint={ctx.hints.get(o.id)} next={ctx.nexts.get(o.id)} onToggle={ctx.onToggle} />
    </div>
  );
});

const DragColumn = memo(function DragColumn({ stage, ids, byId, hot, dragging, ctx }: {
  stage: OppStage; ids: number[]; byId: Map<number, Opportunity>; hot: boolean; dragging: boolean; ctx: CardCtx;
}) {
  const { setNodeRef } = useDroppable({ id: stage });
  const items = useMemo(() => ids.map((id) => byId.get(id)).filter(Boolean) as Opportunity[], [ids, byId]);
  return (
    <Shell stage={stage} count={items.length} sum={sumOf(items)} hot={hot} dragging={dragging} setRef={setNodeRef}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((o) => <SortableCard key={o.id} o={o} ctx={ctx} />)}
      </SortableContext>
    </Shell>
  );
});

/** Phone list: the same columns stacked, no drag; the stage is changed from the card's details */
const ListColumn = memo(function ListColumn({ stage, ids, byId, ctx, onMove }: {
  stage: OppStage; ids: number[]; byId: Map<number, Opportunity>; ctx: CardCtx; onMove: (id: number, to: OppStage) => void;
}) {
  const items = useMemo(() => ids.map((id) => byId.get(id)).filter(Boolean) as Opportunity[], [ids, byId]);
  return (
    <Shell stage={stage} count={items.length} sum={sumOf(items)} dragging={false}>
      {items.map((o) => (
        <OppCard key={o.id} o={o} mobile open={ctx.exp === o.id} hint={ctx.hints.get(o.id)} next={ctx.nexts.get(o.id)} onToggle={ctx.onToggle} onMove={onMove} />
      ))}
    </Shell>
  );
});

function Edges() {
  return (
    <>
      <div className="pipe-edge is-left" aria-hidden="true"><span className="pipe-edge-btn"><BoardIcon name="chevronLeft" className="size-icon-md" stroke={2.2} /></span></div>
      <div className="pipe-edge is-right" aria-hidden="true"><span className="pipe-edge-btn"><BoardIcon name="chevronRight" className="size-icon-md" stroke={2.2} /></span></div>
    </>
  );
}

/** The kanban board: drag between columns (desktop), the stacked list (phone), the lost reason dialog */
export function Board({ visible, all, byId, stages, desk, exp, hints, nexts, onToggle }: {
  visible: Opportunity[];
  /** every row of the board query: the stored order of a column is judged against it */
  all: Opportunity[];
  byId: Map<number, Opportunity>;
  stages: OppStage[];
  desk: boolean;
  exp: number | null;
  hints: Map<number, string>;
  nexts: Map<number, string>;
  onToggle: (id: number) => void;
}) {
  const grouped = useMemo(() => group(visible), [visible]);
  const [dragCols, setDragCols] = useState<Cols>(grouped);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<OppStage | null>(null);
  const [lostAsk, setLostAsk] = useState<{ id: number; index: number } | null>(null);
  const cols = activeId != null || lostAsk ? dragCols : grouped;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: ACTIVATE_DISTANCE } }),
    useSensor(TouchSensor, { activationConstraint: { delay: TOUCH_DELAY_MS, tolerance: ACTIVATE_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ctx = useMemo<CardCtx>(() => ({ exp, hints, nexts, onToggle }), [exp, hints, nexts, onToggle]);

  const stageOf = useCallback((id: number | string): OppStage | undefined => {
    if (typeof id === "string") return id as OppStage;
    return ALL_STAGES.find((s) => dragCols[s].includes(id));
  }, [dragCols]);

  const onStart = (e: DragStartEvent) => {
    setDragCols(grouped);
    setActiveId(Number(e.active.id));
  };
  const onOver = ({ active, over }: DragOverEvent) => {
    if (!over) return setOverStage(null);
    const from = stageOf(active.id as number);
    const to = stageOf(over.id as number | string);
    setOverStage(to ?? null);
    if (!from || !to || from === to) return;
    setDragCols((c) => {
      const id = Number(active.id);
      const target = c[to].filter((x) => x !== id);
      const overIndex = typeof over.id === "number" ? target.indexOf(over.id) : target.length;
      target.splice(overIndex < 0 ? target.length : overIndex, 0, id);
      return { ...c, [from]: c[from].filter((x) => x !== id), [to]: target };
    });
  };

  /** Turns the place in the visible column into the place in the whole column and saves it */
  const move = async (id: number, to: OppStage, visIndex: number, reason?: string) => {
    const cur = byId.get(id);
    if (!cur) return;
    const nextVisible = cols[to].filter((x) => x !== id)[visIndex];
    const full = all.filter((o) => o.stage === to && o.id !== id).map((o) => o.id);
    const position = nextVisible === undefined ? full.length : Math.max(0, full.indexOf(nextVisible));
    if (cur.stage === to && cur.position === position) return;
    const before = mutate<List<Opportunity>>(K.board, (prev) =>
      prev && {
        ...prev,
        rows: prev.rows.map((o) => (o.id === id ? { ...o, stage: to, position: position - 0.5 } : o)).sort((a, b) =>
          ALL_STAGES.indexOf(a.stage) - ALL_STAGES.indexOf(b.stage) || a.position - b.position),
      });
    try {
      await run("post", `/opportunities/${id}/move`, { stage: to, position, reason }, { ok: cur.stage !== to ? `${cur.title} → ${STAGE[to]}` : undefined });
    } catch {
      mutate<List<Opportunity>>(K.board, () => before);
    }
  };

  const onEnd = ({ active, over }: DragEndEvent) => {
    const id = Number(active.id);
    lastDragEnd = Date.now();
    setActiveId(null);
    setOverStage(null);
    if (!over) return;
    const to = stageOf(over.id as number | string);
    const cur = byId.get(id);
    if (!to || !cur) return;
    const list = cols[to].filter((x) => x !== id);
    let index = typeof over.id === "number" && over.id !== id ? list.indexOf(over.id) : cols[to].indexOf(id);
    if (index < 0) index = list.length;
    if (to === "kaybedildi" && cur.stage !== "kaybedildi") return setLostAsk({ id, index });
    void move(id, to, index);
  };
  const onCancel = () => {
    setActiveId(null);
    setOverStage(null);
  };

  const askName = lostAsk ? byId.get(lostAsk.id) : undefined;
  const lost = (
    <LostReason
      open={!!lostAsk}
      name={askName ? `${askName.company_name ?? askName.title}${askName.estimated_value ? ` · ${lira(askName.estimated_value)}` : ""}` : undefined}
      onCancel={() => setLostAsk(null)}
      onSave={(reason) => {
        if (lostAsk) void move(lostAsk.id, "kaybedildi", lostAsk.index, reason);
        setLostAsk(null);
      }}
    />
  );
  const active = activeId != null ? byId.get(activeId) : undefined;

  if (!desk) {
    return (
      <div className="pipe-boardwrap pipe-mobile">
        <div className="pipe-board" role="region" aria-label="Fırsat panosu">
          {stages.map((s) => (
            <ListColumn key={s} stage={s} ids={grouped[s]} byId={byId} ctx={ctx}
              onMove={(id, to) => (to === "kaybedildi" ? (setDragCols(grouped), setLostAsk({ id, index: grouped[to].length })) : void move(id, to, grouped[to].length))} />
          ))}
        </div>
        {lost}
      </div>
    );
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} autoScroll={AUTO_SCROLL} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={onCancel}>
      <div className="pipe-boardwrap">
        {activeId != null ? <Edges /> : null}
        <div className="pipe-board" data-dragging={activeId != null || undefined} role="region" aria-label="Fırsat panosu">
          {stages.map((s) => (
            <DragColumn key={s} stage={s} ids={cols[s]} byId={byId} hot={activeId != null && overStage === s} dragging={activeId != null} ctx={ctx} />
          ))}
        </div>
      </div>
      <DragOverlay>{active ? <OppCard o={active} open={false} overlay /> : null}</DragOverlay>
      {lost}
    </DndContext>
  );
}
