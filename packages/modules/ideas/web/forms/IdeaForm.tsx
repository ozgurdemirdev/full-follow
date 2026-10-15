// The idea form of the sheet
import { useEffect, useMemo, useState } from "react";
import { useIdeas, useOwnProjects } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Detail, Idea } from "@kit/api/types";
import { Form } from "@kit/components/forms/Form";
import { AreaField, ChipsField, SegField, TextField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import { emptyRef, type Ref } from "@kit/forms/helpers";
import { SectorTagsField } from "@kit/forms/pickers";
import { errorsOf, saveRecord, useSubmit, type FormProps } from "@kit/forms/shared";
import { IDEA_STAGE } from "@kit/lib/labels";
import { IDEA_STAGES, PRIORITIES, PRIORITY } from "../labels";

const PROJECT_NONE = "none";

export function IdeaForm(p: FormProps) {
  const editId = p.sheet.preset?.idea_id;
  const existing = useQuery<Detail<Idea>>(editId ? `/ideas/${editId}` : null);
  const ideas = useIdeas();
  const projects = useOwnProjects();
  const [projectId, setProjectId] = useState(p.sheet.preset?.own_project_id ? String(p.sheet.preset.own_project_id) : "");
  const [priority, setPriority] = useState("orta");
  const [parent, setParent] = useState<Ref>(emptyRef);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [money, setMoney] = useState("");
  const [stage, setStage] = useState("fikir");
  const [sectors, setSectors] = useState<(number | string)[]>([]);
  const [notes, setNotes] = useState("");

  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setTitle(row.title);
    setProjectId(row.own_project_id ? String(row.own_project_id) : "");
    setPriority(row.priority);
    setParent({ id: row.parent_id, text: "" });
    setProblem(row.problem ?? "");
    setMoney(row.money_note ?? "");
    setStage(row.stage);
    setSectors(row.sectors.map((s) => s.id));
    setNotes(row.notes ?? "");
  }, [row]);
  const parentOptions = useMemo(
    () => ideas.rows.filter((x) => !x.parent_id && !x.own_project_id && x.id !== editId).map((x) => ({ id: x.id, label: x.title })),
    [ideas.rows, editId],
  );
  useEffect(() => {
    if (parent.id && !parent.text) {
      const x = ideas.byId.get(parent.id);
      if (x) setParent({ id: x.id, text: x.title });
    }
  }, [ideas.byId, parent]);
  const where = useMemo(
    () => [{ value: PROJECT_NONE, label: "Para kazanma fikirleri" }, ...projects.rows.filter((x) => x.status !== "birakildi" || String(x.id) === projectId).map((x) => ({ value: String(x.id), label: x.name }))],
    [projects.rows, projectId],
  );

  const submit = useSubmit(
    p,
    async () => {
      // "Sağlık > Diş hekimi" yazılırsa eksik sektörler açılır
      // inside a project: priority only; general idea: stage, sectors and optional parent
      const data = projectId
        ? { title: title.trim(), problem, notes, own_project_id: Number(projectId), priority }
        : { title: title.trim(), problem, money_note: money, stage, notes, sectors, parent_id: parent.id, ...(row?.own_project_id ? { own_project_id: null } : {}) };
      await saveRecord(p, editId, data);
    },
    () => errorsOf({ title: !title.trim() && "Başlık gerekli" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="title" label="Başlık" req value={title} onChange={setTitle} placeholder="Örn. klinik randevu botu" autoFocus />
      <ChipsField label="Nerede" value={projectId || PROJECT_NONE} onChange={(v) => v && setProjectId(v === PROJECT_NONE ? "" : v)} options={where} />
      <AreaField label={projectId ? "Açıklama" : "Çözdüğü sorun"} opt value={problem} onChange={setProblem} placeholder={projectId ? "Bu fikir ne yapacak" : "Kimin hangi derdini çözüyor"} rows={3} />
      {projectId ? (
        <SegField label="Öncelik" options={PRIORITIES.map((x) => ({ value: x, label: PRIORITY[x] }))} value={priority} onChange={setPriority} />
      ) : (
        <>
          <TextField label="Para notu" opt value={money} onChange={setMoney} placeholder="Kabaca nasıl para kazandırır" />
          <ChipsField label="Aşama" value={stage} onChange={(v) => v && setStage(v)} options={IDEA_STAGES.map((s) => ({ value: s, label: IDEA_STAGE[s] }))} />
          <SectorTagsField value={sectors} onChange={setSectors} />
          <ComboField label="Üst fikir" opt value={parent} onChange={setParent} options={parentOptions} placeholder="Bağlı olduğu fikir" />
        </>
      )}
      <AreaField label="Notlar" opt value={notes} onChange={setNotes} rows={3} />
    </Form>
  );
}
