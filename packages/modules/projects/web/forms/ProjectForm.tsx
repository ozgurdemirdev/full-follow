// Direct project entry for work that did not go through the pipeline (won opportunities open their project themselves)
import { useState } from "react";
import { Form } from "@kit/components/forms/Form";
import { ChipsField, DateField, NumField, TextField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import { todayIso } from "@kit/lib/format";
import { PROJECT_STEPS, PROJECT_STAGE, type ProjectStage } from "@kit/lib/labels";
import { emptyRef, ensurePerson, type Ref } from "@kit/forms/helpers";
import { errorsOf, saveRecord, usePersonOptions, useSubmit, type FormProps } from "@kit/forms/shared";

const PRICE_STEP = 1000;
const FEE_STEP = 100;
const STAGE_OPTIONS = PROJECT_STEPS.map((s) => ({ value: s, label: PROJECT_STAGE[s] }));

export function ProjectForm(p: FormProps) {
  const personOptions = usePersonOptions();
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
        name: name.trim(), person_id: await ensurePerson(person, { tags: ["müşteri"] }),
        price: price ?? 0, maintenance_fee: fee, started_at: started || undefined, stage,
      });
    },
    () => errorsOf({ name: !name.trim() && "Proje adı gerekli", person: !person.text.trim() && "Müşteriyi seç ya da yeni bir ad yaz" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="name" label="Proje adı" req value={name} onChange={setName} placeholder="Örn. Pizza Z mobil uygulama" autoFocus />
      <ComboField name="person" label="Müşteri" req value={person} onChange={setPerson} options={personOptions} placeholder="Kişi ara ya da yeni ad yaz" newLabel="Yeni kişi" />
      <NumField label="Toplam" half prefix="₺" step={PRICE_STEP} value={price} onChange={setPrice} />
      <NumField label="Bakım ücreti" half opt prefix="₺" suffix="/ ay" step={FEE_STEP} value={fee} onChange={setFee} />
      <ChipsField label="Aşama" value={stage} onChange={(v) => v && setStage(v)} options={STAGE_OPTIONS} />
      <DateField label="Başlangıç" half value={started} onChange={setStarted} placeholder="Örn. 12 Ekim" />
    </Form>
  );
}
