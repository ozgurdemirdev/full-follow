// Direct project entry for work that did not go through the pipeline (won opportunities open their project themselves)
import { useState } from "react";
import { run } from "../api/actions";
import { Combo } from "../components/Combo";
import { NumberField } from "../components/NumberField";
import { Field } from "../components/Sheet";
import { todayIso } from "../lib/format";
import { emptyRef, ensurePerson, type Ref } from "./helpers";
import { SubmitGuard, useSubmit, usePersonOptions, type FormProps } from "./QuickAdd";

export function ProjectForm(p: FormProps) {
  const personOptions = usePersonOptions();
  const [name, setName] = useState("");
  const [person, setPerson] = useState<Ref>(emptyRef);
  const [price, setPrice] = useState<number | null>(null);
  const [fee, setFee] = useState<number | null>(null);
  const [started, setStarted] = useState(todayIso());

  const submit = useSubmit(p, async () => {
    await run("post", "/projects", {
      name: name.trim(), person_id: await ensurePerson(person, { tags: ["müşteri"] }),
      price: price ?? 0, maintenance_fee: fee, started_at: started || undefined,
    }, { ok: "Proje eklendi" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <Field label="Proje adı" htmlFor="pr-name">
        <input id="pr-name" className="inp" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Pizza Z mobil uygulama" />
      </Field>
      <Field label="Müşteri (kişi)" htmlFor="pr-person">
        <Combo id="pr-person" value={person} onChange={setPerson} options={personOptions} placeholder="Kişi ara ya da yeni ad yaz" />
      </Field>
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Fiyat (₺)" htmlFor="pr-price">
          <NumberField id="pr-price" className="inp font-mono" min={0} value={price} onChange={setPrice} />
        </Field>
        <Field label="Başlangıç" htmlFor="pr-start">
          <input id="pr-start" className="inp" type="date" value={started} onChange={(e) => setStarted(e.target.value)} />
        </Field>
      </div>
      <Field label="Aylık bakım ücreti (₺, isteğe bağlı)" htmlFor="pr-fee">
        <NumberField id="pr-fee" className="inp font-mono" min={0} value={fee} onChange={setFee} />
      </Field>
      <SubmitGuard ok={!!name.trim() && !!person.text.trim()} />
    </form>
  );
}
