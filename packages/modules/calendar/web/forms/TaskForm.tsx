// The task form of the sheet
import { useEffect, useState } from "react";
import { useQuery } from "@kit/api/store";
import type { Detail, Task, TaskKind } from "@kit/api/types";
import { Form } from "@kit/components/forms/Form";
import { DateField, SegField, TextField, TimeField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import { todayIso } from "@kit/lib/format";
import { ASSIGNEE_ITEMS, type TaskAssignee } from "@kit/lib/labels";
import { emptyRef, type Ref } from "@kit/forms/helpers";
import { errorsOf, saveRecord, useLinkOptions, useSubmit, type FormProps } from "@kit/forms/shared";
import { TASK_KIND_ITEMS } from "../labels";

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
    () => errorsOf({ title: !title.trim() && "Başlık gerekli" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="title" label="Başlık" req value={title} onChange={setTitle} placeholder="Örn. muhasebeci ile görüş, toplantı" autoFocus />
      <DateField label="Gün" half quick value={due} onChange={setDue} />
      <TimeField label="Saat" half opt value={time} onChange={setTime} placeholder="Gün içi" />
      <SegField label="Tür" options={KINDS} value={kind} onChange={setKind} />
      <SegField label="Kim yapacak" options={ASSIGNEE_ITEMS} value={who} onChange={setWho} />
      <ComboField label="Neyle ilgili" opt value={target} onChange={setTarget} options={options} placeholder="Kişi, firma, fırsat ya da proje ara" />
    </Form>
  );
}
