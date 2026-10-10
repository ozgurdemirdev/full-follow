// Ideas of one own project: Yüksek / Orta / Düşük groups, drag order on desktop, up/down on mobile, done list
import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { run } from "../api/actions";
import { mutate } from "../api/store";
import type { Detail, Idea, IdeaPriority, OwnProject, Thread } from "../api/types";
import { openSheet } from "../app/ui";
import { useIsDesktop } from "../lib/media";
import { PRIORITIES, PRIORITY } from "../lib/labels";
import { Icon } from "./icons";
import { Who } from "./ui";

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

export function ProjectIdeas({ projectId, ideas, detailKey }: { projectId: number; ideas: Idea[]; detailKey: string }) {
  const desk = useIsDesktop();
  const byId = new Map(ideas.map((i) => [i.id, i]));
  const [cols, setCols] = useState<Cols>(() => group(ideas));
  const [activeId, setActiveId] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  useEffect(() => {
    if (activeId == null) setCols(group(ideas));
  }, [ideas, activeId]);
  const done = ideas.filter((i) => i.done_at);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
    setCols((c) => {
      const target = c[to].filter((x) => x !== id);
      const at = typeof over.id === "number" ? target.indexOf(over.id) : target.length;
      target.splice(at < 0 ? target.length : at, 0, id);
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
    const list = cols[to].filter((x) => x !== id);
    let index = typeof over.id === "number" && over.id !== id ? list.indexOf(over.id) : cols[to].indexOf(id);
    if (index < 0) index = list.length;
    if (cur.priority === to && cur.position === index) return setCols(group(ideas));
    list.splice(index, 0, id);
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
    <section className="flex flex-col gap-5" aria-label="Fikirler">
      <QuickAdd projectId={projectId} />
      {total === 0 && done.length === 0 ? <span className="text-base-sm text-text-muted">Bu projede fikir yok. Aklına geleni yukarıdan ekle; sürükleyerek sırala.</span> : null}
      {desk ? (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => (setActiveId(null), setCols(group(ideas)))}>
          {groups}
          <DragOverlay>{active ? <RowBody idea={active} overlay /> : null}</DragOverlay>
        </DndContext>
      ) : groups}
      {done.length ? (
        <div className="flex flex-col gap-2">
          <button type="button" className="self-start border-0 bg-transparent p-0 text-base-sm text-text-secondary hover:text-text-primary" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            Yapılanlar ({done.length})
          </button>
          {showDone ? done.map((i) => (
            <div key={i.id} className="row flex items-center gap-3 py-2">
              <span className="min-w-0 flex-grow truncate text-base text-text-muted line-through">{i.title}</span>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="Geri al" onClick={() => setDone(i.id, false)}>Geri al</button>
            </div>
          )) : null}
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
    <div className="flex flex-wrap gap-3">
      <input className="inp min-w-0 flex-1" placeholder="Fikir ekle" aria-label="Fikir ekle" value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void add())} />
      <select className="inp w-auto" aria-label="Öncelik" value={priority} onChange={(e) => setPriority(e.target.value)}>
        {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
      </select>
      <button type="button" className="btn btn-sec" disabled={busy || !title.trim()} onClick={() => void add()}>Ekle</button>
    </div>
  );
}

function Group({ priority, ids, desk, children }: { priority: string; ids: number[]; desk: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group:${priority}`, disabled: !desk });
  return (
    <div ref={setNodeRef} className={`flex flex-col gap-1 rounded-card transition-colors dur-fade ${isOver ? "bg-surface-inset" : ""}`}>
      <h3 className="m-0 text-base-sm font-medium text-text-secondary">{PRIORITY[priority]} · {ids.length}</h3>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{children}</SortableContext>
      {desk && !ids.length ? <span className="inset px-6 py-4 text-base-sm text-text-muted">Buraya sürükle</span> : null}
    </div>
  );
}

function Row({ idea, desk, first, last, onDone, onStep }: { idea: Idea; desk: boolean; first: boolean; last: boolean; onDone: () => void; onStep: (dir: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: idea.id, disabled: !desk });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? "opacity-disabled" : ""}>
      <RowBody idea={idea}
        handle={desk ? <button type="button" ref={setActivatorNodeRef} className="ibtn cursor-grab" aria-label="Sırala" {...attributes} {...listeners}><Icon name="menu" /></button> : null}
        steps={desk ? null : (
          <>
            <button type="button" className="ibtn" aria-label="Yukarı" disabled={first} onClick={() => onStep(-1)}><Icon name="arrow" className="size-icon-lg -rotate-90" /></button>
            <button type="button" className="ibtn" aria-label="Aşağı" disabled={last} onClick={() => onStep(1)}><Icon name="arrow" className="size-icon-lg rotate-90" /></button>
          </>
        )}
        onDone={onDone} />
    </div>
  );
}

function RowBody({ idea, handle, steps, onDone, overlay }: { idea: Idea; handle?: React.ReactNode; steps?: React.ReactNode; onDone?: () => void; overlay?: boolean }) {
  return (
    <div className={`row flex items-center gap-2 py-2 ${overlay ? "card px-4" : ""}`}>
      {handle}
      <button type="button" className="ibtn" aria-label="Yapıldı" onClick={onDone}><Icon name="check" /></button>
      <button type="button" className="flex min-w-0 flex-grow flex-col items-start border-0 bg-transparent p-0 text-left text-text-primary"
        onClick={() => Date.now() - lastDragEnd > 250 && openSheet("idea", { idea_id: idea.id })}>
        <span className="w-full truncate text-base">{idea.title}</span>
        {idea.problem ? <span className="w-full truncate text-base-sm text-text-muted">{idea.problem}</span> : null}
      </button>
      <Who actor={idea.created_by} />
      {steps}
    </div>
  );
}
