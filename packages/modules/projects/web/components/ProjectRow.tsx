import { memo } from "react";
import { lira } from "@kit/lib/format";
import { PROJECT_STAGE } from "@kit/lib/labels";
import { WAIT_CHIP, type ProjectView } from "../projects";
import { BoardIcon } from "@kit/components/boardIcons";
import { Avatar } from "@kit/components/ui";
import { ProjectDetail } from "./ProjectDetail";

/** One project: the closed row (avatar, received vs total, milestone money track, wait chip, next step) and, when open, its detail */
export const ProjectRow = memo(function ProjectRow({ v, open, onToggle }: { v: ProjectView; open: boolean; onToggle: (id: number) => void }) {
  const { p } = v;
  const chip = v.wait ? { key: v.wait, text: WAIT_CHIP[v.wait] } : v.finished ? { key: "done", text: "Bitti" } : null;
  return (
    <article className="prj-item" data-record={`project-${p.id}`} data-open={open} data-late={v.wait === "late"}>
      <button type="button" className="prj-head" aria-expanded={open} aria-controls={`prj-detail-${p.id}`} onClick={() => onToggle(p.id)}>
        <span className="prj-who">
          <Avatar name={p.person_name} id={p.person_id} size="tile" className="prj-avatar" />
          <span className="prj-names">
            <span className="prj-name">{p.name}</span>
            <span className="prj-client">{p.person_name} · {lira(v.got)} / {lira(v.total)} alındı</span>
          </span>
        </span>
        <span className="prj-track" aria-label={`${PROJECT_STAGE[p.stage]} aşamasında`}>
          {v.steps.map((s) => (
            <span key={s.stage} className="prj-step" data-money={s.state}>
              <span className="prj-line" data-on={s.lineOn} />
              <span className="prj-dot" data-done={s.done} data-now={s.now}>{s.done ? <BoardIcon name="check" className="size-icon-sm" stroke={3} /> : null}</span>
              <span className="prj-step-name" data-done={s.done} data-now={s.now}>{PROJECT_STAGE[s.stage]}</span>
              <span className="prj-step-money">{s.money ? lira(s.money) : ""}</span>
            </span>
          ))}
        </span>
        <span className="prj-next" data-w={chip?.key}>
          {chip ? <span className="prj-chip">{chip.text}</span> : null}
          <span className="prj-next-text">{v.next}</span>
        </span>
      </button>
      {open ? <ProjectDetail v={v} /> : null}
    </article>
  );
});
