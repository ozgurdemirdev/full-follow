// The task form of the sheet
import { useEffect, useState } from "react";
import { useQuery } from "@kit/api/store";
import type { Detail, Task, TaskKind } from "@kit/api/types";
import { Form } from "@kit/components/forms/Form";
import { DateField, SegField, TextField, TimeField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import { todayIso } from "@kit/lib/format";
import { type TaskAssignee } from "@kit/lib/labels";
import { ASSIGNEE_ITEMS } from "../labels";
import { emptyRef, type Ref } from "@kit/forms/helpers";
import { errorsOf, saveRecord, useLinkOptions, useSubmit, type FormProps } from "@kit/forms/shared";
import { TASK_KIND_ITEMS } from "../labels";
import { m as kit } from "@kit/messages";
import { m } from "../messages";

/** Task kinds in the board's order: Görüşme, Takip, Görev */
const KINDS = (["gorusme", "takip", "gorev"] as const).map((v) => TASK_KIND_ITEMS.find((k) => k.value === v)!);

// ---------------------------------------------------------------- görev
export function TaskForm(p: FormProps) {
  const options = useLinkOptions();
  const pre = p.sheet.preset;
  const editId = pre?.edit;
  const existing = useQuery<Detail<Task>>(editId ? `/tasks/${editId}` : null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(pre?.date ?? todayIso());
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<TaskKind>("gorev");
  const [who, setWho] = useState<TaskAssignee>("ozgur");
  const [target, setTarget] = useState<Ref>(emptyRef);
  const row = existing.data?.row;
  /** The record the task is already tied to (edit) or was opened from (preset) */
  const linked = row
    ? { person: row.person_id, company: row.company_id, opportunity: row.opportunity_id, project: row.project_id }
    : { person: pre?.person_id, company: pre?.company_id, opportunity: pre?.opportunity_id, project: pre?.project_id };
  useEffect(() => {
    if (row) {
      setTitle(row.title);
      setDue(row.due_date ?? "");
      setTime(row.due_time ?? "");
      setKind(row.kind);
      setWho(row.assignee);
    }
    const hit = options.find((o) => linked[o.type] === o.tid);
    if (hit) setTarget({ id: hit.id, text: hit.label });
    // options arrive after the first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, options]);

  const submit = useSubmit(
    p,
    async () => {
      const t = options.find((o) => o.id === target.id);
      const link = { person_id: null, company_id: null, opportunity_id: null, project_id: null, ...(t ? { [`${t.type}_id`]: t.tid } : {}) };
      await saveRecord(
        p, editId,
        { title: title.trim(), assignee: who, due_date: due || null, due_time: time || null, kind, ...link },
        { title: title.trim(), assignee: who, due_date: due || undefined, due_time: time || undefined, kind, ...link },
      );
    },
    () => errorsOf({ title: !title.trim() && m.taskForm.titleRequired }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="title" label={kit.fields.title} req value={title} onChange={setTitle} placeholder={m.taskForm.titlePlaceholder} autoFocus />
      <DateField label={m.taskForm.day} half quick value={due} onChange={setDue} />
      <TimeField label={m.taskForm.time} half opt value={time} onChange={setTime} placeholder={m.anytime} />
      <SegField label={kit.fields.type} options={KINDS} value={kind} onChange={setKind} />
      <SegField label={m.taskForm.who} options={ASSIGNEE_ITEMS} value={who} onChange={setWho} />
      <ComboField label={m.taskForm.about} opt value={target} onChange={setTarget} options={options} placeholder={m.taskForm.aboutPlaceholder} />
    </Form>
  );
}
