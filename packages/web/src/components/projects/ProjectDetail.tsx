import { Link } from "wouter";
import { run } from "../../api/actions";
import { PATHS, timelinePath } from "../../app/routes";
import { lira } from "../../lib/format";
import { MILESTONE } from "../../lib/labels";
import { askClaude, type ProjectView } from "../../lib/projects";
import { remaining } from "../../lib/dashboard";
import { BoardIcon } from "../boardIcons";
import { FilesCard } from "../FilesCard";
import { LinksCard } from "../LinksCard";
import { ProjectAdmin } from "./ProjectAdmin";

const BY = { ozgur: "Sen", claude: "Claude", musteri: "Müşteri" } as const;

/** Expanded project: tasks with owner, payments (Alındı), Claude's note with the reminder request, then links, files and admin */
export function ProjectDetail({ v }: { v: ProjectView }) {
  const { p } = v;
  const toggle = (id: number, done: boolean) => void run("patch", `/tasks/${id}`, { done: !done }, { silent: true }).catch(() => {});
  return (
    <div className="prj-detail" id={`prj-detail-${p.id}`}>
      <div className="prj-sec">
        <span className="prj-sec-label">Görevler</span>
        {v.tasks.length === 0 ? <span className="prj-row text-text-muted">Görev yok.</span> : null}
        {v.tasks.map((t) => {
          const done = !!t.done_at;
          return (
            <div key={t.id} className="prj-row">
              <button type="button" className="prj-check" aria-pressed={done} aria-label={`${t.title}${done ? ", tamamlandı" : ", tamamla"}`} onClick={() => toggle(t.id, done)}>
                {done ? <BoardIcon name="check" className="size-icon-sm" stroke={2.6} /> : null}
              </button>
              <span className="prj-task-text" data-done={done}>{t.title}</span>
              <span className="prj-by" data-by={t.assignee}>{BY[t.assignee]}</span>
            </div>
          );
        })}
      </div>

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
          <Link href={timelinePath("project", p.id)} className="prj-link">Zaman çizelgesi</Link>
        </div>
      </div>

      <LinksCard type="project" id={p.id} plain />
      {p.files ? <FilesCard type="project" id={p.id} files={p.files} plain /> : null}
      <ProjectAdmin p={p} />
    </div>
  );
}
