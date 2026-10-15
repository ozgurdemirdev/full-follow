import { useRef } from "react";
import type { OwnProject } from "@kit/api/types";
import { OWN_STATUS } from "../labels";
import { rateText, STATUS_DOT } from "../ownProjects";
import { BoardIcon } from "@kit/components/boardIcons";
import { Masonry } from "@kit/components/layout";
import { order } from "@kit/components/ui";
import { m as kit } from "@kit/messages";
import { STROKE } from "../constants";
import { m } from "../messages";
import { Journey, SellChip } from "./Bits";

function ProjectCard({ p, i, onOpen }: { p: OwnProject; i: number; onOpen: (from: DOMRect) => void }) {
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
      {p.next_idea ? (
        <div className="opr-card-next">
          <span>{m.gallery.next}</span>
          <span className="text-base">{p.next_idea.title}</span>
        </div>
      ) : null}
      <div className="opr-card-foot">
        <span>{p.told ? m.gallery.interestShort(rateText(p), p.told) : m.gallery.notTold}</span>
        <button type="button" className="ff-more" aria-label={m.openProject(p.name)} onClick={() => root.current && onOpen(root.current.getBoundingClientRect())}>
          {kit.open}
          <span className="ff-more-ic"><BoardIcon name="expand" className="size-icon-chip" stroke={STROKE.medium} /></span>
        </button>
      </div>
    </section>
  );
}

/** The other projects in work, in three masonry columns (two on tablets, one on phones) */
export function Gallery({ rows, onOpen }: { rows: OwnProject[]; onOpen: (id: number, from: DOMRect) => void }) {
  if (!rows.length) return null;
  return (
    <div className="opr-sec">
      <div className="opr-sec-head">
        <h2>{m.gallery.title}</h2>
        <span>{m.gallery.hint}</span>
      </div>
      <Masonry columns={3}>
        {rows.map((p, i) => <ProjectCard key={p.id} p={p} i={i} onOpen={(from) => onOpen(p.id, from)} />)}
      </Masonry>
    </div>
  );
}
