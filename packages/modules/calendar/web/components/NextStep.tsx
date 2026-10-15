import { remove } from "@kit/api/actions";
import type { Task } from "@kit/api/types";
import { openSheet } from "@kit/app/ui";
import { fmtDay, followNote } from "@kit/lib/format";
import { ACTOR } from "@kit/lib/labels";
import { EditDelete } from "@kit/components/contact";
import { Card, Who } from "@kit/components/ui";
import { m as kit } from "@kit/messages";
import { m } from "../messages";

/** The records a next step card is shown for */
type NextStepKind = "person" | "opportunity" | "project";

/** Sort key of a task without a due date: after every real date */
const NO_DUE = "9999-12-31";

/** The open task with the nearest due date */
const nearest = (tasks: Task[]) =>
  tasks.filter((x) => !x.done_at).sort((a, b) => (a.due_date ?? NO_DUE).localeCompare(b.due_date ?? NO_DUE))[0];

/** Next follow-up date and the nearest open task of a person, opportunity or project, plus a button to add a task */
export function NextStep({ tasks, type, id, personId, followUp }: { tasks: Task[]; type: NextStepKind; id: number; personId?: number; followUp?: string | null }) {
  const t = nearest(tasks);
  const note = followNote(followUp);
  const preset = type === "person" ? { person_id: id } : type === "opportunity" ? { opportunity_id: id, person_id: personId } : { project_id: id, person_id: personId };
  return (
    <Card title={m.nextStep.title} className="opp-side rise">
      {note ? <p className={`m-0 text-base-sm ${note.late ? "text-warning" : "text-text-secondary"}`}>{note.text}</p> : null}
      {t ? (
        <>
          <p className="m-0 text-base leading-normal">{t.title}</p>
          <div className="flex items-center gap-3">
            <Who actor={t.created_by}>{ACTOR[t.created_by]}{t.due_date ? ` · ${fmtDay(t.due_date)}` : ""}</Who>
            <span className="flex-grow" />
            <EditDelete label={kit.nouns.task} onEdit={() => openSheet("task", { edit: t.id })} onDelete={() => void remove(`/tasks/${t.id}`, kit.nouns.task).catch(() => {})} />
          </div>
        </>
      ) : (
        <p className="m-0 text-base-sm text-text-secondary">{m.nextStep.none}</p>
      )}
      <button type="button" className="btn btn-sec self-start" onClick={() => openSheet("task", preset)}>{m.nextStep.add}</button>
    </Card>
  );
}
