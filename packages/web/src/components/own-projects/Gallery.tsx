import { useRef } from "react";
import type { OwnRow } from "../../api/types";
import { OWN_STATUS } from "../../lib/labels";
import { rateText, STATUS_DOT, type OwnStats } from "../../lib/ownProjects";
import { BoardIcon } from "../boardIcons";
import { Masonry } from "../layout";
import { order } from "../ui";
import { Journey, SellChip } from "./Bits";

function ProjectCard({ p, stats, i, onOpen }: { p: OwnRow; stats: OwnStats; i: number; onOpen: (from: DOMRect) => void }) {
  const root = useRef<HTMLElement>(null);
  return (
    <section ref={root} aria-label={p.name} data-record={`own_project-${p.id}`} className="ff-card opr-card rise" style={order(i)}>
      <div className="opr-card-top">
        <span className={`opr-dot ${STATUS_DOT[p.status]}`} />
        <span className="opr-label">{OWN_STATUS[p.status]}</span>
        <SellChip p={p} size="md" />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="opr-card-name">{p.name}</h3>
        {p.description ? <p className="opr-card-one">{p.description}</p> : null}
      </div>
      <Journey stage={p.stage} variant="card" />
      {stats.next ? (
        <div className="opr-card-next">
          <span>Sırada</span>
          <span className="text-base">{stats.next.title}</span>
        </div>
      ) : null}
      <div className="opr-card-foot">
        <span>{stats.told ? `İlgi ${rateText(stats)} · ${stats.told} kişi` : "Henüz anlatılmadı"}</span>
        <button type="button" className="ff-more" aria-label={`${p.name} projesini aç`} onClick={() => root.current && onOpen(root.current.getBoundingClientRect())}>
          Aç
          <span className="ff-more-ic"><BoardIcon name="expand" className="size-icon-chip" stroke={2.2} /></span>
        </button>
      </div>
    </section>
  );
}

/** The other projects in work, in three masonry columns (two on tablets, one on phones) */
export function Gallery({ rows, stats, empty, onOpen }: { rows: OwnRow[]; stats: Map<number, OwnStats>; empty: OwnStats; onOpen: (id: number, from: DOMRect) => void }) {
  if (!rows.length) return null;
  return (
    <div className="opr-sec">
      <div className="opr-sec-head">
        <h2>Üzerinde çalıştıkların</h2>
        <span>Odağı değiştirmek için projeyi aç</span>
      </div>
      <Masonry columns={3}>
        {rows.map((p, i) => <ProjectCard key={p.id} p={p} stats={stats.get(p.id) ?? empty} i={i} onOpen={(from) => onOpen(p.id, from)} />)}
      </Masonry>
    </div>
  );
}
