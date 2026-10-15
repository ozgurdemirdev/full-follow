// Own product form: what it does, status, could it be sold later, which sectors suit it
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@kit/api/store";
import type { Detail, OwnProject, OwnStage } from "@kit/api/types";
import { Form } from "@kit/components/forms/Form";
import { AreaField, ChipsField, SegField, TextField } from "@kit/components/forms/fields";
import { OWN_STATUS, OWN_STATUSES, SELLABLE, SELLABLES } from "../labels";
import { OWN_PROJECTS_PATH } from "../paths";
import { JOURNEY } from "../ownProjects";
import { SectorTagsField } from "@kit/forms/pickers";
import { errorsOf, saveRecord, useSubmit, type FormProps } from "@kit/forms/shared";
import { m as kit } from "@kit/messages";
import { m } from "../messages";

const SELL_OPTIONS = SELLABLES.map((s) => ({ value: s, label: SELLABLE[s] }));
const STATUS_OPTIONS = OWN_STATUSES.map((s) => ({ value: s, label: OWN_STATUS[s] }));
const STAGE_OPTIONS: { value: OwnStage | ""; label: string }[] = JOURNEY.map((j) => ({ value: j.key, label: j.label }));

export function OwnProjectForm(p: FormProps) {
  const editId = p.sheet.preset?.own_project_id;
  const existing = useQuery<Detail<OwnProject>>(editId ? `/own-projects/${editId}` : null);
  const [, navigate] = useLocation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("aktif");
  const [sellable, setSellable] = useState("belki");
  const [sellableNote, setSellableNote] = useState("");
  const [stage, setStage] = useState<OwnStage | "">(editId ? "" : JOURNEY[0].key);
  const [sectors, setSectors] = useState<(number | string)[]>([]);
  const [notes, setNotes] = useState("");

  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setName(row.name);
    setDescription(row.description ?? "");
    setStatus(row.status);
    setSellable(row.sellable);
    setSellableNote(row.sellable_note ?? "");
    setStage(row.stage ?? "");
    setSectors(row.sectors.map((s) => s.id));
    setNotes(row.notes ?? "");
  }, [row]);

  const submit = useSubmit(
    p,
    async () => {
      const data = { name: name.trim(), description, status, sellable, sellable_note: sellable === "hayir" ? "" : sellableNote, stage: stage || null, sectors, notes };
      const res = await saveRecord<OwnProject>(p, editId, data);
      if (!editId && res.row) navigate(`${OWN_PROJECTS_PATH}/${res.row.id}`);
    },
    () => errorsOf({ name: !name.trim() && m.form.nameRequired }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="name" label={m.form.name} req value={name} onChange={setName} placeholder={m.form.namePlaceholder} autoFocus />
      <TextField label={m.form.oneLine} value={description} onChange={setDescription} placeholder={m.form.oneLinePlaceholder} />
      <ChipsField label={kit.fields.status} value={status} onChange={(v) => v && setStatus(v)} options={STATUS_OPTIONS} />
      <SegField label={m.form.sellable} options={SELL_OPTIONS} value={sellable} onChange={setSellable} />
      {sellable !== "hayir" ? <TextField label={m.form.sellableNote} opt value={sellableNote} onChange={setSellableNote} placeholder={m.form.sellableNotePlaceholder} /> : null}
      <SegField label={kit.fields.stage} options={STAGE_OPTIONS} value={stage} onChange={setStage} />
      <SectorTagsField label={m.form.sectors} value={sectors} onChange={setSectors} />
      <AreaField label={kit.nouns.notes} opt value={notes} onChange={setNotes} rows={3} />
    </Form>
  );
}
