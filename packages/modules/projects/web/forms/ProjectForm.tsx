// Direct project entry for work that did not go through the pipeline (won opportunities open their project themselves)
import { useState } from "react";
import { Form } from "@kit/components/forms/Form";
import { ChipsField, DateField, NumField, TextField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import { todayIso } from "@kit/lib/format";
import { PROJECT_STEPS, PROJECT_STAGE, type ProjectStage } from "@kit/lib/labels";
import { emptyRef, ensurePerson, type Ref } from "@kit/forms/helpers";
import { errorsOf, PERSON_REMOTE, saveRecord, useSubmit, type FormProps } from "@kit/forms/shared";
import { m } from "../messages";
import { m as kit } from "@kit/messages";

const PRICE_STEP = 1000;
const FEE_STEP = 100;
const STAGE_OPTIONS = PROJECT_STEPS.map((s) => ({ value: s, label: PROJECT_STAGE[s] }));

export function ProjectForm(p: FormProps) {
  const [name, setName] = useState("");
  const [person, setPerson] = useState<Ref>(emptyRef);
  const [price, setPrice] = useState<number | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [started, setStarted] = useState(todayIso());
  const [stage, setStage] = useState<ProjectStage>(PROJECT_STEPS[0]);

  const submit = useSubmit(
    p,
    async () => {
      await saveRecord(p, null, {
        name: name.trim(), person_id: await ensurePerson(person, { tags: [m.form.customerTag] }, { person: setPerson }),
        price: price ?? 0, maintenance_fee: fee, started_at: started || undefined, stage,
      });
    },
    () => errorsOf({ name: !name.trim() && m.form.nameRequired, person: !person.text.trim() && m.form.personRequired }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="name" label={m.form.name} req value={name} onChange={setName} placeholder={m.form.namePlaceholder} autoFocus />
      <ComboField name="person" label={m.form.customer} req value={person} onChange={setPerson} remote={PERSON_REMOTE} placeholder={m.form.customerPlaceholder} newLabel={m.form.newPerson} />
      <NumField label={m.form.total} half prefix={kit.lira} step={PRICE_STEP} value={price} onChange={setPrice} />
      <NumField label={m.form.maintenanceFee} half opt prefix={kit.lira} suffix={m.form.perMonth} step={FEE_STEP} value={fee} onChange={setFee} />
      <ChipsField label={kit.fields.stage} value={stage} onChange={(v) => v && setStage(v)} options={STAGE_OPTIONS} />
      <DateField label={m.form.start} half value={started} onChange={setStarted} placeholder={m.form.startPlaceholder} />
    </Form>
  );
}
