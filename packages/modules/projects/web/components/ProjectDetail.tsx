import { Link } from "wouter";
import { run } from "@kit/api/actions";
import { useQuery } from "@kit/api/store";
import type { Detail, FileRow } from "@kit/api/types";
import { Slot } from "@kit/app/modules/Slot";
import { PATHS } from "@kit/app/routes";
import { lira } from "@kit/lib/format";
import { MILESTONE } from "@kit/lib/labels";
import { askClaude, type ProjectView } from "../projects";
import { remaining } from "@kit/lib/dashboard";
import { FilesCard } from "@kit/components/FilesCard";
import { LinksCard } from "@kit/components/LinksCard";
import { ProjectAdmin } from "./ProjectAdmin";

/** Expanded project: tasks with owner, payments (Alındı), Claude's note with the reminder request, then links, files and admin */
export function ProjectDetail({ v }: { v: ProjectView }) {
  const { p } = v;
  const files = useQuery<Detail<unknown, { files?: FileRow[] }>>(`/projects/${p.id}?with=files`);
  return (
    <div className="prj-detail" id={`prj-detail-${p.id}`}>
      <Slot name="project.detail.tasks" props={{ tasks: v.tasks }} />

      <div className="prj-sec">
        <span className="prj-sec-label">Ödemeler</span>
        {v.pays.length === 0 ? <span className="prj-row text-text-muted">Ödeme planı yok.</span> : null}
        {v.pays.map(({ payment: x, state, canMark }) => (
          <div key={x.id} className="prj-row" data-money={state}>
            <span className="prj-pay-dot" />
            <span className="prj-pay-name">{MILESTONE[x.milestone] ?? x.milestone}</span>
            <span className="prj-pay-amount">{x.paid_amount && x.status !== "odendi" ? `${lira(x.paid_amount)} / ${lira(x.expected_amount)}` : lira(x.expected_amount)}</span>
            {canMark ? (
              <button type="button" className="prj-mark"
                onClick={() => void run("post", `/payments/${x.id}/pay`, { amount: remaining(x) }, { ok: `${MILESTONE[x.milestone] ?? x.milestone} ödemesi alındı: ${lira(remaining(x))}` }).catch(() => {})}>
                Alındı
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="prj-sec" data-gap="loose">
        <span className="prj-sec-label">Claude’un notu</span>
        {v.note ? <p className="prj-note"><span className="prj-note-dot" /><span>{v.note}</span></p> : null}
        <div className="prj-actions">
          <button type="button" className="prj-ask" disabled={v.ask.requested}
            onClick={() => void askClaude(p.id, v.ask.title, v.ask.ok)}>
            {v.ask.label}
          </button>
          <Link href={PATHS.comments} className="prj-link">Yorumlar · {v.comments}</Link>
          <Slot name="project.detail.actions" props={{ type: "project", id: p.id, className: "prj-link", label: "Zaman çizelgesi" }} />
        </div>
      </div>

      <LinksCard type="project" id={p.id} plain />
      <FilesCard type="project" id={p.id} files={files.data?.related.files ?? []} plain />
      <ProjectAdmin p={p} />
    </div>
  );
}
