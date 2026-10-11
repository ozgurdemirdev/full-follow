import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { remove, run } from "../api/actions";
import { K, pickable, useBoard, usePeople, useSources } from "../api/keys";
import { mutate } from "../api/store";
import type { List, Opportunity } from "../api/types";
import { Page } from "../app/Page";
import { timelinePath } from "../app/routes";
import { openSheet } from "../app/ui";
import { Icon } from "../components/icons";
import { Field, Sheet } from "../components/Sheet";
import { Chip, ErrorBox, Filters, PageSkeleton, Who } from "../components/ui";
import { fmtDay, followNote, norm, tl } from "../lib/format";
import { useIsDesktop } from "../lib/media";
import { BOARD_STAGES, STAGE, STAGE_BG, type OppStage } from "../lib/labels";

type Cols = Record<OppStage, number[]>;
const ALL_STAGES: OppStage[] = [...BOARD_STAGES, "kaybedildi"];
/** sürükleme bitince hemen gelen tıklamayı yok saymak için */
let lastDragEnd = 0;

function group(rows: Opportunity[]): Cols {
  const c = Object.fromEntries(ALL_STAGES.map((s) => [s, [] as number[]])) as Cols;
  for (const o of rows) c[o.stage]?.push(o.id);
  return c;
}

// Varsayılan eşik kabın %20'si: sağdaki sütundan tutulan kart panoyu hemen kaydırıyordu. Sadece kenara gerçekten yaklaşınca kaydır.
const AUTO_SCROLL = { threshold: { x: 0.06, y: 0.12 }, acceleration: 6 };

export default function Pipeline() {
  const board = useBoard();
  const people = usePeople();
  const sources = useSources();
  const [, navigate] = useLocation();
  const [src, setSrc] = useState<number>(0);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const [showLost, setShowLost] = useState(false);
  const [lostAsk, setLostAsk] = useState<{ id: number; index: number } | null>(null);
  const desk = useIsDesktop();

  // sürükleme sırasında yerel sütun düzeni; veri değişince yeniden kurulur
  const visible = useMemo(() => {
    const n = norm(dq.trim());
    return board.rows.filter((o) => {
      if (src && o.source_id !== src) return false;
      if (!n) return true;
      const company = people.byId.get(o.person_id)?.company_name;
      return norm(o.title).includes(n) || norm(o.person_name).includes(n) || norm(company).includes(n);
    });
  }, [board.rows, src, dq, people.byId]);
  const [cols, setCols] = useState<Cols>(() => group(visible));
  const [activeId, setActiveId] = useState<number | null>(null);
  useEffect(() => {
    if (activeId == null) setCols(group(visible));
  }, [visible, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const stageOf = (id: number | string): OppStage | undefined => {
    if (typeof id === "string") return id as OppStage;
    return ALL_STAGES.find((s) => cols[s].includes(id));
  };

  const onStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));
  const onOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = stageOf(active.id as number);
    const to = stageOf(over.id as number | string);
    if (!from || !to || from === to) return;
    setCols((c) => {
      const id = Number(active.id);
      const target = c[to].filter((x) => x !== id);
      const overIndex = typeof over.id === "number" ? target.indexOf(over.id) : target.length;
      target.splice(overIndex < 0 ? target.length : overIndex, 0, id);
      return { ...c, [from]: c[from].filter((x) => x !== id), [to]: target };
    });
  };
  const onEnd = ({ active, over }: DragEndEvent) => {
    const id = Number(active.id);
    lastDragEnd = Date.now();
    setActiveId(null);
    if (!over) return setCols(group(visible));
    const to = stageOf(over.id as number | string);
    if (!to) return;
    const list = cols[to].filter((x) => x !== id);
    let index = typeof over.id === "number" && over.id !== id ? list.indexOf(over.id) : cols[to].indexOf(id);
    if (index < 0) index = list.length;
    const cur = board.byId.get(id);
    if (!cur) return;
    if (to === "kaybedildi" && cur.stage !== "kaybedildi") return setLostAsk({ id, index });
    void move(id, to, index);
  };

  /** Görünen sıradaki yeri, sütunun tamamındaki sıraya çevirip kaydeder */
  const move = async (id: number, to: OppStage, visIndex: number, reason?: string) => {
    const cur = board.byId.get(id)!;
    const visList = cols[to].filter((x) => x !== id);
    const nextVisible = visList[visIndex];
    const full = board.rows.filter((o) => o.stage === to && o.id !== id).map((o) => o.id);
    const position = nextVisible === undefined ? full.length : Math.max(0, full.indexOf(nextVisible));
    if (cur.stage === to && cur.position === position) return;
    // iyimser: yerel listede aşama ve sırayı güncelle
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

  const openCount = board.rows.filter((o) => o.stage !== "kazanildi" && o.stage !== "kaybedildi").length;
  const openSum = board.rows.reduce((a, o) => (o.stage !== "kazanildi" && o.stage !== "kaybedildi" ? a + (o.estimated_value ?? 0) : a), 0);
  const lostCount = board.rows.filter((o) => o.stage === "kaybedildi").length;
  const stages = showLost ? ALL_STAGES : BOARD_STAGES;
  const active = activeId != null ? board.byId.get(activeId) : undefined;

  return (
    <Page
      title="Satış hunisi"
      sub={board.data ? `${openCount} açık fırsat · tahmini ${tl(openSum)}` : ""}
      width="wide"
      className="flex flex-col gap-7"
      right={
        <label className="hidden h-control-height-md w-search-width flex-none items-center gap-3 rounded-lg border border-border-default bg-surface-inset px-5 text-text-secondary desk:flex">
          <Icon name="search" className="size-icon-md" />
          <input type="search" placeholder="Fırsat ara" aria-label="Fırsat ara" value={q} onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-grow border-0 bg-transparent text-base-sm text-text-primary outline-0 placeholder:text-text-muted" />
        </label>
      }
    >
      {board.error && !board.data ? <ErrorBox error={board.error} retry={board.reload} /> : null}
      {!board.data ? (
        !board.error && <PageSkeleton />
      ) : (
        <>
          <div className="rise flex flex-wrap items-center gap-3">
            <span className="mr-1 text-base-sm text-text-secondary">Kaynak</span>
            <Filters label="Kaynak" value={src} onChange={setSrc} items={[{ value: 0, label: "Tümü" }, ...pickable(sources.rows).map((s) => ({ value: s.id, label: s.name }))]} />
            <span className="flex-grow" />
            <button type="button" className="border-0 bg-transparent text-base-sm text-text-secondary hover:text-text-primary" aria-pressed={showLost} onClick={() => setShowLost((v) => !v)}>
              {showLost ? "Kaybedilenleri gizle" : `Kaybedilenler (${lostCount})`}
            </button>
          </div>

          {desk ? null : (
            <>
              <input className="inp" type="search" placeholder="Fırsat ara" aria-label="Fırsat ara" value={q} onChange={(e) => setQ(e.target.value)} />
              {/* telefonda yatay kaydırma yok: aşamalar alt alta, kart aşaması seçiciyle değişir */}
              {stages.map((s) => (
                <StackColumn key={s} stage={s} items={cols[s].map((id) => board.byId.get(id)).filter(Boolean) as Opportunity[]}
                  companyOf={(pid) => people.byId.get(pid)?.company_name ?? null} onOpen={(id) => navigate(timelinePath("opportunity", id))}
                  onMove={(id, to) => (to === "kaybedildi" ? setLostAsk({ id, index: cols[to].length }) : void move(id, to, cols[to].length))} />
              ))}
            </>
          )}
          {desk ? <DndContext sensors={sensors} collisionDetection={closestCorners} autoScroll={AUTO_SCROLL} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)}>
            <div className="-mx-page-padding-x-mobile flex snap-x snap-proximity gap-6 overflow-x-auto px-page-padding-x-mobile pb-5 desk:mx-0 desk:px-0" role="region" aria-label="Fırsat aşamaları">
              {stages.map((s) => (
                <Column key={s} stage={s} ids={cols[s]} byId={board.byId} companyOf={(pid) => people.byId.get(pid)?.company_name ?? null} onOpen={(id) => navigate(timelinePath("opportunity", id))} />
              ))}
            </div>
            <DragOverlay>{active ? <Card o={active} company={people.byId.get(active.person_id)?.company_name ?? null} overlay /> : null}</DragOverlay>
          </DndContext> : null}
        </>
      )}

      <LostReason
        open={!!lostAsk}
        onCancel={() => {
          setLostAsk(null);
          setCols(group(visible));
        }}
        onSave={(reason) => {
          if (lostAsk) void move(lostAsk.id, "kaybedildi", lostAsk.index, reason);
          setLostAsk(null);
        }}
      />
    </Page>
  );
}

function Column({ stage, ids, byId, companyOf, onOpen }: {
  stage: OppStage;
  ids: number[];
  byId: Map<number, Opportunity>;
  companyOf: (personId: number) => string | null;
  onOpen: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const items = ids.map((id) => byId.get(id)).filter(Boolean) as Opportunity[];
  const sum = items.reduce((a, o) => a + (o.estimated_value ?? 0), 0);
  return (
    <section ref={setNodeRef} aria-label={STAGE[stage]} className={`flex w-kanban-column-mobile flex-none snap-start flex-col gap-4 rounded-card transition-colors dur-fade ${isOver ? "bg-surface-inset" : ""} desk:w-kanban-column`}>
      <div className="flex items-center gap-3 px-1 pb-0.5 pt-1">
        <span className={`dot ${STAGE_BG[stage]}`} />
        <h2 className="m-0 text-base font-semibold">{STAGE[stage]}</h2>
        <span className="text-sm text-text-secondary">{items.length}</span>
        <span className="flex-grow" />
        {sum ? <span className="font-mono text-sm text-text-secondary">{tl(sum)}</span> : null}
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((o, i) => (
          <SortableCard key={o.id} o={o} i={i} company={companyOf(o.person_id)} onOpen={onOpen} />
        ))}
      </SortableContext>
      {stage !== "kazanildi" && stage !== "kaybedildi" ? (
        <button type="button" className="fchip h-control-height-md rounded-xl border-dashed" onClick={() => openSheet("opportunity", { stage })}>
          + Fırsat ekle
        </button>
      ) : null}
    </section>
  );
}

function SortableCard({ o, i, company, onOpen }: { o: Opportunity; i: number; company: string | null; onOpen: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: o.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, ["--i" as string]: Math.min(i, 8) }}
      className={isDragging ? "opacity-disabled" : ""}
      {...attributes}
      {...listeners}
      onClick={() => Date.now() - lastDragEnd > 250 && onOpen(o.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter") onOpen(o.id);
      }}
    >
      <Card o={o} company={company} actions={<CardActions o={o} />} />
    </div>
  );
}

/** Karttaki düzenle / sil (kartın tıklamasını ve sürüklemesini tetiklemez) */
function CardActions({ o, children }: { o: Opportunity; children?: ReactNode }) {
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <span className="flex flex-wrap items-center gap-1" onClick={stop} onPointerDown={stop} onKeyDown={stop}>
      {children}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("opportunity", { edit: o.id })}>Düzenle</button>
      {o.project_id ? null : <button type="button" className="btn btn-ghost btn-sm text-status-text-danger" onClick={() => void remove(`/opportunities/${o.id}`, o.title).catch(() => {})}>Sil</button>}
    </span>
  );
}

/** Telefonda bir aşama: başlık + kartlar alt alta */
function StackColumn({ stage, items, companyOf, onOpen, onMove }: {
  stage: OppStage;
  items: Opportunity[];
  companyOf: (personId: number) => string | null;
  onOpen: (id: number) => void;
  onMove: (id: number, to: OppStage) => void;
}) {
  const sum = items.reduce((a, o) => a + (o.estimated_value ?? 0), 0);
  return (
    <section aria-label={STAGE[stage]} className="flex flex-col gap-4">
      <div className="flex items-center gap-3 px-1 pt-2">
        <span className={`dot ${STAGE_BG[stage]}`} />
        <h2 className="m-0 text-base font-semibold">{STAGE[stage]}</h2>
        <span className="text-sm text-text-secondary">{items.length}</span>
        <span className="flex-grow" />
        {sum ? <span className="font-mono text-sm text-text-secondary">{tl(sum)}</span> : null}
      </div>
      {items.map((o) => (
        <div key={o.id} role="link" tabIndex={0} onClick={() => onOpen(o.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(o.id)}>
          <Card o={o} company={companyOf(o.person_id)} actions={
            <CardActions o={o}>
              <select className="inp h-control-height-sm w-auto" aria-label="Aşamayı değiştir" value={o.stage} onChange={(e) => onMove(o.id, e.target.value as OppStage)}>
                {ALL_STAGES.map((s) => <option key={s} value={s}>{STAGE[s]}</option>)}
              </select>
            </CardActions>
          } />
        </div>
      ))}
      {stage !== "kazanildi" && stage !== "kaybedildi" ? (
        <button type="button" className="fchip h-control-height-md rounded-xl border-dashed" onClick={() => openSheet("opportunity", { stage })}>+ Fırsat ekle</button>
      ) : null}
    </section>
  );
}

const Card = memo(function Card({ o, company, overlay, actions }: { o: Opportunity; company: string | null; overlay?: boolean; actions?: ReactNode }) {
  const note = o.stage === "kazanildi" ? { text: o.project_id ? "Projeye dönüştü" : "Kazanıldı", late: false }
    : o.stage === "kaybedildi" ? { text: o.lost_reason ?? "Kaybedildi", late: false }
    : followNote(o.next_follow_up_at);
  return (
    <article data-record={`opportunity-${o.id}`} className={`card rise-item lift flex cursor-grab touch-manipulation select-none flex-col gap-4 rounded-card-sm p-6 ${overlay ? "cursor-grabbing shadow-card-hover" : ""}`}>
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-semibold">{company ?? o.title}</span>
        <span className="text-base-sm text-text-secondary">{company ? `${o.title} · ` : ""}{o.person_name}</span>
      </div>
      {o.source_url ? (
        <a href={o.source_url} target="_blank" rel="noreferrer" className="truncate text-sm" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          İlan{o.source_date ? ` · ${fmtDay(o.source_date)}` : ""} ↗
        </a>
      ) : o.source_date ? <span className="text-sm text-text-muted">İlan · {fmtDay(o.source_date)}</span> : null}
      <div className="flex items-center gap-2">
        <Chip tone="source">{o.source_name}</Chip>
        <span className="flex-grow" />
        {o.estimated_value ? <span className="font-mono text-base-sm">{tl(o.estimated_value)}</span> : null}
      </div>
      <div className="flex items-center gap-3 border-t border-border-subtle pt-4">
        <Who actor={o.created_by} />
        {note ? <span className={`truncate text-sm ${note.late ? "text-status-text-attention" : "text-text-secondary"}`}>{note.text}</span> : null}
      </div>
      {actions && !overlay ? <div className="-mb-2 flex justify-end">{actions}</div> : null}
    </article>
  );
});

function LostReason({ open, onCancel, onSave }: { open: boolean; onCancel: () => void; onSave: (r: string) => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [open]);
  return (
    <Sheet
      open={open}
      title="Neden kaybedildi?"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-sec btn-lg" onClick={onCancel}>Vazgeç</button>
          <button type="button" className="btn btn-pri btn-lg" disabled={!reason.trim()} onClick={() => onSave(reason.trim())}>Kaydet</button>
        </>
      }
    >
      <Field label="Neden" htmlFor="lost-reason">
        <textarea id="lost-reason" className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn. bütçe uymadı, başkasıyla anlaştı" />
      </Field>
    </Sheet>
  );
}
