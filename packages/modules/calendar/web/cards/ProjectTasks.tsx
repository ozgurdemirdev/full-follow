import { run } from "@kit/api/actions";
import type { ProjectTask } from "@kit/api/types";
import { BoardIcon } from "@kit/components/boardIcons";
import { ASSIGNEE } from "@kit/lib/labels";

const toggle = (id: number, done: boolean) => void run("patch", `/tasks/${id}`, { done: !done }, { silent: true }).catch(() => {});

/** The tasks section of an expanded project (slot "project.detail.tasks" of the projects page): owner chip and a check to tick one off; the rows use the page's own styles */
export function ProjectTasks({ tasks }: { tasks: ProjectTask[] }) {
  return (
    <div className="prj-sec">
      <span className="prj-sec-label">Görevler</span>
      {tasks.length === 0 ? <span className="prj-row text-text-muted">Görev yok.</span> : null}
      {tasks.map((t) => {
        const done = !!t.done_at;
        return (
          <div key={t.id} className="prj-row">
            <button type="button" className="prj-check" aria-pressed={done} aria-label={`${t.title}${done ? ", tamamlandı" : ", tamamla"}`} onClick={() => toggle(t.id, done)}>
              {done ? <BoardIcon name="check" className="size-icon-sm" stroke={2.6} /> : null}
            </button>
            <span className="prj-task-text" data-done={done}>{t.title}</span>
            <span className="prj-by" data-by={t.assignee}>{ASSIGNEE[t.assignee]}</span>
          </div>
        );
      })}
    </div>
  );
}
