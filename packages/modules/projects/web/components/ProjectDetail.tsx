import { Link } from "wouter";
import { run } from "@kit/api/actions";
import { useQuery } from "@kit/api/store";
import type { Detail, FileRow } from "@kit/api/types";
import { Slot } from "@kit/app/modules/Slot";
import { PATHS } from "@kit/app/routes";
import { lira } from "@kit/lib/format";
import { MILESTONE } from "@kit/lib/labels";
import { useTasksOn } from "@kit/lib/taskAccess";
import { useAskClaude } from "@kit/lib/askClaude";
import type { ProjectView } from "../projects";
import { remaining } from "@kit/lib/dashboard";
import { FilesCard } from "@kit/components/FilesCard";
import { LinksCard } from "@kit/components/LinksCard";
import { m } from "../messages";
import { ProjectAdmin } from "./ProjectAdmin";
import { m as kit } from "@kit/messages";

/** Expanded project: tasks with owner, payments (Alındı), Claude's note with the reminder request, then links, files and admin */
export function ProjectDetail({ v }: { v: ProjectView }) {
  const { p } = v;
  const tasksOn = useTasksOn();
  const { asked, ask } = useAskClaude();
  const request = { title: v.ask.title, target: { project_id: p.id }, ok: v.ask.ok };
  const requested = v.ask.requested || asked(request);
  const files = useQuery<Detail<unknown, { files?: FileRow[] }>>(`/projects/${p.id}?with=files`);
  return (
    <div className="prj-detail" id={`prj-detail-${p.id}`}>
      <Slot name="project.detail.tasks" props={{ tasks: v.tasks }} />

      <div className="prj-sec">
        <span className="prj-sec-label">{kit.nouns.payments}</span>
        {v.pays.length === 0 ? <span className="prj-row text-text-muted">{m.detail.noPayments}</span> : null}
        {v.pays.map(({ payment: x, state, canMark }) => (
          <div key={x.id} className="prj-row" data-money={state}>
            <span className="prj-pay-dot" />
            <span className="prj-pay-name">{MILESTONE[x.milestone] ?? x.milestone}</span>
            <span className="prj-pay-amount">{x.paid_amount && x.status !== "odendi" ? `${lira(x.paid_amount)} / ${lira(x.expected_amount)}` : lira(x.expected_amount)}</span>
            {canMark ? (
              <button type="button" className="prj-mark"
                onClick={() => void run("post", `/payments/${x.id}/pay`, { amount: remaining(x) }, { ok: m.detail.received(MILESTONE[x.milestone] ?? x.milestone, lira(remaining(x))) }).catch(() => {})}>
                {m.detail.markReceived}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="prj-sec" data-gap="loose">
        <span className="prj-sec-label">{m.detail.claudeNote}</span>
        {v.note ? <p className="prj-note"><span className="prj-note-dot" /><span>{v.note}</span></p> : null}
        <div className="prj-actions">
          {tasksOn ? (
            <button type="button" className="prj-ask" disabled={requested}
              onClick={() => void ask(request)}>
              {requested ? m.ask.requested : v.ask.label}
            </button>
          ) : null}
          <Link href={PATHS.comments} className="prj-link">{m.detail.comments(v.comments)}</Link>
          <Slot name="project.detail.actions" props={{ type: "project", id: p.id, className: "prj-link", label: m.detail.timeline }} />
        </div>
      </div>

      <LinksCard type="project" id={p.id} plain />
      <FilesCard type="project" id={p.id} files={files.data?.related.files ?? []} plain />
      <ProjectAdmin p={p} />
    </div>
  );
}
