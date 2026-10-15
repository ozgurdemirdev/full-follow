// Ideas of one own project: Yüksek / Orta / Düşük columns, drag order on desktop, up/down on mobile, done list
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState, type ReactNode } from "react";
import { run } from "@kit/api/actions";
import { mutate } from "@kit/api/store";
import type { Detail, Idea, IdeaPriority, OwnProject, Thread } from "@kit/api/types";
import { openSheet } from "@kit/app/ui";
import { IDEA_STAGE } from "@kit/lib/labels";
import { CLICK_AFTER_DRAG_MS, DRAG_DISTANCE } from "../constants";
import { PRIORITIES, PRIORITY } from "../labels";
import { m } from "../messages";
import { useIsDesktop } from "@kit/lib/media";
import { BoardIcon } from "@kit/components/boardIcons";
import { Icon } from "@kit/components/icons";
import { m as kit } from "@kit/messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** Chip colours of the idea stage (board values, reused chip tokens) */
const IDEA_STAGE_CLS: Record<string, string> = {
  fikir: "bg-chip-neutral-bg text-chip-neutral-fg",
  dogrulaniyor: "bg-chip-ask-bg text-chip-ask-fg",
  demo: "bg-chip-opportunity-bg text-chip-opportunity-fg",
  urun: "bg-chip-success-bg text-chip-success-fg",
};
const PRIORITY_DOT: Record<string, string> = { yuksek: "bg-danger", orta: "bg-warning", dusuk: "bg-text-muted" };

type Cols = Record<string, number[]>;
type Dt = Detail<OwnProject, { ideas: Idea[]; comments: Thread[] }>;

const open = (ideas: Idea[]) => ideas.filter((i) => !i.done_at);
const sorted = (ideas: Idea[]) => [...ideas].sort((a, b) => a.position - b.position || a.id - b.id);
function group(ideas: Idea[]): Cols {
  const c: Cols = Object.fromEntries(PRIORITIES.map((p) => [p, [] as number[]]));
  for (const i of sorted(open(ideas))) c[i.priority]?.push(i.id);
  return c;
}
/** sürükleme bitince hemen gelen tıklamayı yok saymak için */
let lastDragEnd = 0;
/** Stacked groups wrap their rows, so corner distance often picks the group: prefer the row under the pointer, then the group, then the nearest row */
const collide: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const rows = hits.filter((c) => typeof c.id === "number");
  return rows.length ? rows : hits.length ? hits : closestCenter(args);
};

export function ProjectIdeas({ projectId, ideas, detailKey }: { projectId: number; ideas: Idea[]; detailKey: string }) {
  const desk = useIsDesktop();
  const byId = new Map(ideas.map((i) => [i.id, i]));
  const [cols, setCols] = useState<Cols>(() => group(ideas));
  const [activeId, setActiveId] = useState<number | null>(null);
  useEffect(() => {
    if (activeId == null) setCols(group(ideas));
  }, [ideas, activeId]);
  const done = ideas.filter((i) => i.done_at);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groupOf = (id: number | string): string | undefined =>
    typeof id === "string" ? id.replace("group:", "") : PRIORITIES.find((p) => cols[p].includes(id));

  /** Optimistic: write the local order back into the cached detail, restore it when the request fails */
  const save = async (id: number, next: Cols, patch: { priority?: string; position: number }) => {
    const prev = mutate<Dt>(detailKey, (d) => d && {
      ...d,
      related: {
        ...d.related,
        ideas: d.related.ideas.map((i) => {
          const p = PRIORITIES.find((x) => next[x].includes(i.id));
          return p ? { ...i, priority: p as IdeaPriority, position: next[p].indexOf(i.id) } : i;
        }),
      },
    });
    try {
      await run("patch", `/ideas/${id}`, patch, { silent: true });
    } catch {
      mutate<Dt>(detailKey, () => prev);
      setCols(group(ideas));
    }
  };

  const onStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));
  const onOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const id = Number(active.id);
    const from = groupOf(id);
    const to = groupOf(over.id as number | string);
    if (!from || !to || from === to) return;
    const dragged = active.rect.current.translated;
    const below = !!dragged && dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2;
    setCols((c) => {
      const target = c[to].filter((x) => x !== id);
      const overAt = typeof over.id === "number" ? target.indexOf(over.id) : -1;
      target.splice(overAt < 0 ? target.length : overAt + (below ? 1 : 0), 0, id);
      return { ...c, [from]: c[from].filter((x) => x !== id), [to]: target };
    });
  };
  const onEnd = ({ active, over }: DragEndEvent) => {
    const id = Number(active.id);
    lastDragEnd = Date.now();
    setActiveId(null);
    const cur = byId.get(id);
    const to = over ? groupOf(over.id as number | string) : undefined;
    if (!over || !to || !cur) return setCols(group(ideas));
    // onOver already moved the row into the target group; finish the move inside it
    const from = cols[to].indexOf(id);
    const overAt = typeof over.id === "number" ? cols[to].indexOf(over.id) : -1;
    const list = from >= 0 && overAt >= 0 ? arrayMove(cols[to], from, overAt) : cols[to];
    const index = list.indexOf(id);
    if (index < 0 || (cur.priority === to && cur.position === index)) return setCols(group(ideas));
    const next = { ...cols, [to]: list };
    setCols(next);
    void save(id, next, cur.priority === to ? { position: index } : { priority: to, position: index });
  };

  /** Mobile: one step up or down inside the group */
  const step = (id: number, p: string, dir: -1 | 1) => {
    const list = cols[p];
    const at = list.indexOf(id);
    const to = at + dir;
    if (to < 0 || to >= list.length) return;
    const moved = [...list];
    moved.splice(at, 1);
    moved.splice(to, 0, id);
    const next = { ...cols, [p]: moved };
    setCols(next);
    void save(id, next, { position: to });
  };

  const setDone = (id: number, value: boolean) => void run("patch", `/ideas/${id}`, { done: value }, { silent: true }).catch(() => {});
  const active = activeId != null ? byId.get(activeId) : undefined;
  const total = PRIORITIES.reduce((a, p) => a + cols[p].length, 0);

  const groups = PRIORITIES.map((p) => {
    const ids = cols[p];
    if (!desk && !ids.length) return null;
    return (
      <Group key={p} priority={p} ids={ids} desk={desk}>
        {ids.map((id, n) => {
          const i = byId.get(id);
          return i ? (
            <Row key={id} idea={i} desk={desk} first={n === 0} last={n === ids.length - 1}
              onDone={() => setDone(id, true)} onStep={(dir) => step(id, p, dir)} />
          ) : null;
        })}
      </Group>
    );
  });

  return (
    <section className="opr-ideas" aria-label={m.project.label}>
      <div className="opr-ideas-head">
        <h3>{m.project.label}</h3>
        <QuickAdd projectId={projectId} />
      </div>
      {total === 0 && done.length === 0 ? <span className="opr-empty">{m.project.empty}</span> : null}
      {desk ? (
        <DndContext sensors={sensors} collisionDetection={collide} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => (setActiveId(null), setCols(group(ideas)))}>
          <div className="opr-cols">{groups}</div>
          <DragOverlay>{active ? <IdeaCard idea={active} overlay /> : null}</DragOverlay>
        </DndContext>
      ) : <div className="opr-cols">{groups}</div>}
      {done.length ? (
        <div className="opr-done">
          <span>{m.project.done}</span>
          {done.map((i) => (
            <button key={i.id} type="button" aria-label={m.project.undo(i.title)} onClick={() => setDone(i.id, false)}>
              <span className="opr-done-tick"><BoardIcon name="check" className="size-own-done-tick" stroke={STROKE.black} /></span>
              {i.title}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function QuickAdd({ projectId }: { projectId: number }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("orta");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await run("post", "/ideas", { title: title.trim(), own_project_id: projectId, priority }, { silent: true });
      setTitle("");
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="opr-add">
      <input placeholder={m.project.addPlaceholder} aria-label={m.project.addLabel} value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void add())} />
      <select aria-label={kit.fields.priority} value={priority} onChange={(e) => setPriority(e.target.value)}>
        {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
      </select>
      <button type="button" className="opr-add-btn" aria-label={m.project.addLabel} disabled={busy || !title.trim()} onClick={() => void add()}>
        <BoardIcon name="plus" className="size-icon-chip" stroke={STROKE.medium} />
      </button>
    </div>
  );
}

function Group({ priority, ids, desk, children }: { priority: string; ids: number[]; desk: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group:${priority}`, disabled: !desk });
  return (
    <div ref={setNodeRef} className="opr-colbox" data-over={isOver}>
      <h4 className="opr-colhead">
        <span className={`opr-dot ${PRIORITY_DOT[priority]}`} />
        {PRIORITY[priority]}
        <span className="opr-colcount">{ids.length}</span>
      </h4>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
      {desk && !ids.length ? <span className="opr-drop">{m.project.dropHere}</span> : null}
    </div>
  );
}

function Row({ idea, desk, first, last, onDone, onStep }: { idea: Idea; desk: boolean; first: boolean; last: boolean; onDone: () => void; onStep: (dir: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: idea.id, disabled: !desk });
  // the whole card is the drag surface; a keyboard drag starts only with focus on the card itself, so the buttons inside keep their keys
  const drag = desk ? { ref: setActivatorNodeRef, tabIndex: attributes.tabIndex, "aria-roledescription": attributes["aria-roledescription"], "aria-describedby": attributes["aria-describedby"], ...listeners } : undefined;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? "opacity-disabled" : ""}>
      <IdeaCard idea={idea} drag={drag} onDone={onDone}
        steps={desk ? null : (
          <div className="opr-steps">
            <button type="button" className="ibtn" aria-label={m.project.up} disabled={first} onClick={() => onStep(-1)}><Icon name="arrow" className="size-icon-lg -rotate-90" /></button>
            <button type="button" className="ibtn" aria-label={m.project.down} disabled={last} onClick={() => onStep(1)}><Icon name="arrow" className="size-icon-lg rotate-90" /></button>
          </div>
        )} />
    </div>
  );
}

/** A click that ends a drag is not a click on the card's buttons */
const settled = () => Date.now() - lastDragEnd > CLICK_AFTER_DRAG_MS;

function IdeaCard({ idea, drag, steps, onDone, overlay }: { idea: Idea; drag?: object; steps?: ReactNode; onDone?: () => void; overlay?: boolean }) {
  return (
    <div className="opr-idea" data-drag={drag ? "" : undefined} data-overlay={overlay ? "" : undefined} {...drag}>
      <div className="opr-idea-top">
        <button type="button" className="opr-idea-check" aria-label={m.project.markDone(idea.title)} onClick={() => settled() && onDone?.()} />
        <button type="button" className="opr-idea-title" onClick={() => settled() && openSheet("idea", { idea_id: idea.id })}>{idea.title}</button>
      </div>
      <div className="opr-idea-meta">
        <span className={`opr-chip ${IDEA_STAGE_CLS[idea.stage]}`} data-size="sm">{IDEA_STAGE[idea.stage]}</span>
        <span>{idea.told ? m.project.toldLine(idea.told, idea.interested) : m.project.notTold}</span>
        {steps}
      </div>
    </div>
  );
}
