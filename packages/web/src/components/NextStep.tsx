import { remove } from "../api/actions";
import type { Task } from "../api/types";
import { openSheet } from "../app/ui";
import { fmtDay, followNote } from "../lib/format";
import { ACTOR } from "../lib/labels";
import { EditDelete } from "./contact";
import type { FeedKind } from "./Feed";
import { Who } from "./ui";

/** Sort key of a task without a due date: after every real date */
const NO_DUE = "9999-12-31";

/** The open task with the nearest due date */
const nearest = (tasks: Task[]) =>
  tasks.filter((x) => !x.done_at).sort((a, b) => (a.due_date ?? NO_DUE).localeCompare(b.due_date ?? NO_DUE))[0];

/** Next follow-up date and the nearest open task of a person, opportunity or project, plus a button to add a task */
export function NextStep({ tasks, type, id, personId, followUp }: { tasks: Task[]; type: FeedKind; id: number; personId?: number; followUp?: string | null }) {
  const t = nearest(tasks);
  const note = followNote(followUp);
  const preset = type === "person" ? { person_id: id } : type === "opportunity" ? { opportunity_id: id, person_id: personId } : { project_id: id, person_id: personId };
  return (
    <section className="card rise flex flex-col gap-3 p-8">
      <h2 className="m-0 text-base font-semibold">Sıradaki adım</h2>
      {note ? <p className={`m-0 text-base-sm ${note.late ? "text-warning" : "text-text-secondary"}`}>{note.text}</p> : null}
      {t ? (
        <>
          <p className="m-0 text-base leading-normal">{t.title}</p>
          <div className="flex items-center gap-3">
            <Who actor={t.created_by}>{ACTOR[t.created_by]}{t.due_date ? ` · ${fmtDay(t.due_date)}` : ""}</Who>
            <span className="flex-grow" />
            <EditDelete label="Görev" onEdit={() => openSheet("task", { edit: t.id })} onDelete={() => void remove(`/tasks/${t.id}`, "Görev").catch(() => {})} />
          </div>
        </>
      ) : (
        <p className="m-0 text-base-sm text-text-secondary">Açık görev yok.</p>
      )}
      <button type="button" className="btn btn-sec self-start" onClick={() => openSheet("task", preset)}>Görev ekle</button>
    </section>
  );
}
