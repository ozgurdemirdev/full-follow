// Task and comment forms of the sheet
import { useEffect, useState } from "react";
import { run } from "../api/actions";
import { useQuery } from "../api/store";
import type { Detail, Task, TaskKind } from "../api/types";
import { Form, Note } from "../components/forms/Form";
import { AreaField, DateField, SegField, TextField, TimeField } from "../components/forms/fields";
import { ComboField } from "../components/forms/fields-rich";
import { todayIso } from "../lib/format";
import { TASK_KIND_ITEMS } from "../lib/labels";
import { emptyRef, type Ref } from "./helpers";
import { errorsOf, saveRecord, useLinkOptions, useSubmit, type FormProps } from "./shared";

const WHO = [{ value: "ozgur" as const, label: "Sen" }, { value: "claude" as const, label: "Claude" }];
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
  const [who, setWho] = useState<Task["assignee"]>("ozgur");
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
      <SegField label="Kim yapacak" options={WHO} value={who} onChange={setWho} />
      <ComboField label="Neyle ilgili" opt value={target} onChange={setTarget} options={options} placeholder="Kişi, firma, fırsat ya da proje ara" />
    </Form>
  );
}

// ---------------------------------------------------------------- yorum
export function CommentForm(p: FormProps) {
  const preTarget = p.sheet.preset?.target;
  const options = useLinkOptions();
  const [target, setTarget] = useState<Ref>(emptyRef);
  const [body, setBody] = useState("");

  const submit = useSubmit(
    p,
    async () => {
      const t = preTarget ?? (() => {
        const o = options.find((x) => x.id === target.id);
        return o ? { type: o.type, id: o.tid } : null;
      })();
      if (!t) throw new Error("hedef yok");
      await run("post", "/comments", { target_type: t.type, target_id: t.id, body: body.trim() }, { ok: "Yorum eklendi, Claude MCP’den görecek" });
    },
    () => errorsOf({ target: !preTarget && !target.id && "Neyle ilgili olduğunu seç", body: !body.trim() && "Yorum boş olamaz" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      {preTarget ? (
        <Note>{preTarget.label}</Note>
      ) : (
        <ComboField name="target" label="Neyle ilgili" req value={target} onChange={setTarget} options={options} placeholder="Fırsat, proje, kişi ya da firma ara" />
      )}
      <AreaField name="body" label="Yorum" req value={body} onChange={setBody} placeholder="Not ya da soru yaz" rows={5} hint="Özgür olarak yazıyorsun · Claude MCP’den okuyup cevaplar" />
    </Form>
  );
}
