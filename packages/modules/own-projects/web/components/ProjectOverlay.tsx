import { Fragment } from "react";
import { remove, run } from "@kit/api/actions";
import { useQuery } from "@kit/api/store";
import type { Detail, Idea, OwnProject, Thread } from "@kit/api/types";
import { Slot } from "@kit/app/modules/Slot";
import { openSheet } from "@kit/app/ui";
import { OWN_STATUS, OWN_STATUSES } from "../labels";
import { ratePct } from "@kit/lib/format";
import { rateNote, rateText, setStage } from "../ownProjects";
import { usePopover } from "@kit/lib/usePopover";
import { BoardIcon } from "@kit/components/boardIcons";
import { Comments } from "@kit/components/contact";
import { ExpandOverlay } from "@kit/components/ExpandOverlay";
import { ErrorBox, Meter, Skeleton } from "@kit/components/ui";
import { Journey, SellChip, StarIcon } from "./Bits";
import { OwnLinks } from "./OwnLinks";

type Related = { ideas: Idea[]; comments: Thread[] };

/** Header menu: the things the board leaves out (edit form, delete) */
function HeaderMenu({ p, onClose }: { p: OwnProject; onClose: () => void }) {
  const { open, setOpen, root } = usePopover();
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={root} className="relative">
      <button type="button" className="ppl-round" aria-label="Diğer işlemler" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <BoardIcon name="dots" className="size-icon-md" stroke={2.4} />
      </button>
      <div role="menu" aria-hidden={!open} className="ppl-pop" inert={!open}>
        <button type="button" role="menuitem" className="ppl-pop-item" onClick={pick(() => openSheet("own_project", { own_project_id: p.id }))}>Düzenle</button>
        <button type="button" role="menuitem" className="ppl-pop-item text-danger hover:text-danger" onClick={pick(() => void remove(`/own-projects/${p.id}`, `“${p.name}” projesi`).then(onClose).catch(() => {}))}>Sil</button>
      </div>
    </div>
  );
}

/** Left column: sellability, validation meter, links, comments, notes */
function Aside({ p, threads }: { p: OwnProject; threads: Thread[] }) {
  return (
    <div className="opr-aside">
      <div className="opr-panel">
        <span className="opr-label">Para kazandırır mı?</span>
        <SellChip p={p} className="self-start" />
        {p.sellable_note ? <p className="opr-sell-note">{p.sellable_note}</p> : null}
        <div className="flex flex-wrap gap-2">
          {p.sectors.length
            ? p.sectors.map((s) => <span key={s.id} className="opr-chip bg-chip-source-bg text-chip-source-fg">{s.path}</span>)
            : <span className="opr-empty">Uygun sektör seçilmedi</span>}
        </div>
      </div>
      <div className="opr-panel" data-gap="md">
        <span className="opr-label">Doğrulama</span>
        <div className="opr-rate">
          <span className="opr-rate-value">{rateText(p)}</span>
          <span className="opr-rate-note">{rateNote(p)}</span>
        </div>
        <Meter value={p.interest_share === null ? 0 : ratePct(p.interest_share)} size="lg" label="İlgi oranı" />
      </div>
      <OwnLinks id={p.id} />
      <div className="opr-panel">
        <Comments target={{ type: "own_project", id: p.id, label: p.name }} threads={threads} />
      </div>
      {p.notes ? <p className="opr-panel opr-sell-note m-0">{p.notes}</p> : null}
    </div>
  );
}

/** A project as the board's dialog: grows from the clicked card, status pills and journey in the header, panels left, idea columns right */
export function ProjectOverlay({ id, from, p, isFocus, onFocus, onClose }: {
  id: number | null;
  from: DOMRect | null;
  p: OwnProject | undefined;
  isFocus: boolean;
  onFocus: (p: OwnProject) => void;
  onClose: () => void;
}) {
  const key = id ? `/own-projects/${id}?with=ideas,comments` : null;
  const d = useQuery<Detail<OwnProject, Related>>(key);
  const row = d.data?.row ?? p;
  const setStatus = (status: string) => row && status !== row.status && run("patch", `/own-projects/${row.id}`, { status }, { ok: `Durum: ${OWN_STATUS[status]}` }).catch(() => {});

  return (
    <ExpandOverlay
      open={!!id && !!row}
      from={from}
      title={row?.name ?? "Proje"}
      onClose={onClose}
      headerClassName="opr-head"
      bodyClassName="opr-body"
      header={row ? (
        <>
          <div className="opr-head-top">
            <div className="opr-head-titles">
              <h2 className="opr-ex-title">{row.name}</h2>
              {row.description ? <p>{row.description}</p> : null}
            </div>
            <button type="button" className="opr-focus" aria-pressed={isFocus} onClick={() => onFocus(row)}>
              <StarIcon className="size-icon-xs" />
              {isFocus ? "Odakta" : "Odağa al"}
            </button>
            <HeaderMenu p={row} onClose={onClose} />
            <button type="button" className="ff-ex-close" data-close aria-label="Küçült" onClick={onClose}>
              <BoardIcon name="shrink" className="size-icon-btn" stroke={2.2} />
            </button>
          </div>
          <div className="opr-head-bar">
            <div className="opr-status" role="radiogroup" aria-label="Durum">
              {OWN_STATUSES.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={row.status === s} onClick={() => setStatus(s)}>{OWN_STATUS[s]}</button>
              ))}
            </div>
            <Journey stage={row.stage} variant="ex" onPick={(step) => void setStage(row, step)} />
          </div>
        </>
      ) : null}
    >
      {row ? (
        d.error && !d.data ? <ErrorBox error={d.error} retry={d.reload} /> : (
          <div className="opr-board">
            {d.data ? <Aside p={row} threads={d.data.related.comments ?? []} /> : <Skeleton className="h-chart-height" />}
            {d.data ? <Fragment key={row.id}><Slot name="own-project.overlay.ideas" props={{ projectId: row.id, ideas: d.data.related.ideas ?? [], detailKey: key }} /></Fragment> : <Skeleton className="h-chart-height" />}
          </div>
        )
      ) : null}
    </ExpandOverlay>
  );
}
