// Opportunity form of the sheet: create (person, company, source, stage, first step and comment) and edit
import { useEffect, useMemo, useState } from "react";
import { run } from "@kit/api/actions";
import { pickable, usePeople, useSources } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Detail, Opportunity, Source } from "@kit/api/types";
import { Form, Note } from "@kit/components/forms/Form";
import { AreaField, ChipsField, DateField, NumField, TextField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import { addDaysIso, todayIso } from "@kit/lib/format";
import { OPEN_STAGES, STAGE, type OppStage } from "@kit/lib/labels";
import { emptyRef, ensurePerson, type Ref } from "@kit/forms/helpers";
import { errorsOf, saveRecord, useCompanyOptions, usePersonOptions, useSubmit, type FormProps } from "@kit/forms/shared";
import { m } from "../messages";

const VALUE_STEP = 1000;
const STAGE_OPTIONS = OPEN_STAGES.map((s) => ({ value: s, label: STAGE[s], dot: `var(--color-stage-${s})` }));

export function OpportunityForm(p: FormProps) {
  if (p.sheet.preset?.edit) return <OpportunityEdit {...p} id={p.sheet.preset.edit} />;
  return <OpportunityCreate {...p} />;
}

/** Listing link and date (an R10 ad): both optional */
function SourceLinkFields({ url, setUrl, date, setDate }: { url: string; setUrl: (v: string) => void; date: string; setDate: (v: string) => void }) {
  return (
    <>
      <TextField label={m.form.sourceLink} half opt type="url" prefix="https://" value={url} onChange={setUrl} placeholder={m.form.sourceLinkPlaceholder} />
      <DateField label={m.form.listingDate} half opt value={date} onChange={setDate} placeholder={m.form.datePlaceholder} />
    </>
  );
}

/** The listing link as the record keeps it: with a scheme */
const withScheme = (v: string) => (!v.trim() || /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);
const showUrl = (v: string | null | undefined) => (v ?? "").replace(/^https:\/\//i, "");

/** Fırsat düzenleme: başlık, tutar, kaynak, ilan linki ve tarihi, takip tarihi (aşama huniden) */
function OpportunityEdit(p: FormProps & { id: number }) {
  const d = useQuery<Detail<Opportunity>>(`/opportunities/${p.id}`);
  const o = d.data?.row;
  const sources = useSources();
  const personOptions = usePersonOptions();
  const [person, setPerson] = useState<Ref>(emptyRef);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [url, setUrl] = useState("");
  const [srcDate, setSrcDate] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    if (!o) return;
    setPerson({ id: o.person_id, text: o.person_name });
    setTitle(o.title);
    setValue(o.estimated_value || null);
    setSourceId(String(o.source_id));
    setUrl(showUrl(o.source_url));
    setSrcDate(o.source_date ?? "");
    setDate(o.next_follow_up_at ?? "");
  }, [o]);
  const submit = useSubmit(
    p,
    async () => {
      await saveRecord(p, p.id, {
        person_id: await ensurePerson(person, { tags: [m.form.candidateTag] }), title: title.trim(), estimated_value: value, source_id: Number(sourceId),
        source_url: withScheme(url), source_date: srcDate || null, next_follow_up_at: date || null,
      });
    },
    () => errorsOf({ person: !person.text.trim() && m.form.pickContact, title: !title.trim() && m.form.titleRequired }),
  );
  if (!o) return null;
  return (
    <Form id={p.formId} onSubmit={submit}>
      <Note>{m.form.stageNote(STAGE[o.stage])}</Note>
      <ComboField name="person" label={m.form.contact} req value={person} onChange={setPerson} options={personOptions} placeholder={m.form.personPlaceholder} newLabel={m.shared.newPerson} />
      <TextField name="title" label={m.shared.title} req value={title} onChange={setTitle} placeholder={m.form.titlePlaceholder} />
      <ChipsField label={m.shared.source} value={sourceId} onChange={(v) => v && setSourceId(v)} options={pickable(sources.rows, [o.source_id]).map((s) => ({ value: String(s.id), label: s.name }))} />
      <SourceLinkFields url={url} setUrl={setUrl} date={srcDate} setDate={setSrcDate} />
      <NumField label={m.form.value} half prefix={m.shared.currency} step={VALUE_STEP} value={value} onChange={setValue} />
      <DateField label={m.form.nextDate} half quick value={date} onChange={setDate} placeholder={m.form.nextDatePlaceholder} />
    </Form>
  );
}

function OpportunityCreate(p: FormProps) {
  const sources = useSources();
  const people = usePeople();
  const personOptions = usePersonOptions();
  const companyOptions = useCompanyOptions();

  const [person, setPerson] = useState<Ref>(emptyRef);
  const [company, setCompany] = useState<Ref>(emptyRef);
  // Mevcut kişi seçilince firması da gelir
  const pickPerson = (v: Ref) => {
    setPerson(v);
    const x = v.id ? people.byId.get(v.id) : undefined;
    if (x?.company_id) setCompany({ id: x.company_id, text: x.company_name ?? "" });
  };
  const [title, setTitle] = useState("");
  const [sourceId, setSourceId] = useState<string>("");
  const [newSource, setNewSource] = useState("");
  const [referrer, setReferrer] = useState<Ref>(emptyRef);
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(addDaysIso(todayIso(), 1));
  const [stage, setStage] = useState<OppStage>(p.sheet.preset?.stage ?? "bulundu");
  const [step, setStep] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [srcDate, setSrcDate] = useState("");

  const live = useMemo(() => pickable(sources.rows), [sources.rows]);
  const src = sourceId ? sources.byId.get(Number(sourceId)) : live[0];
  const isRef = src ? src.kind === "referans" || /referans/i.test(src.name) : false;

  const submit = useSubmit(
    p,
    async () => {
      let source_id = src?.id;
      if (!source_id) {
        const s = await run<Source>("post", "/sources", { name: newSource.trim() || m.form.other }, { silent: true });
        source_id = s.row!.id;
      }
      const person_id = await ensurePerson(person, { company, referred_by: isRef ? referrer : undefined, tags: [m.form.candidateTag], next_follow_up_at: date });
      const res = await saveRecord<Opportunity>(p, null, {
        title: title.trim() || company.text.trim() || person.text.trim(),
        person_id, source_id, stage,
        estimated_value: value,
        next_follow_up_at: date || undefined,
        source_url: withScheme(url) || undefined, source_date: srcDate || undefined,
      });
      const oid = res.row!.id;
      if (step.trim()) await run("post", "/tasks", { title: step.trim(), assignee: "ozgur", due_date: date || undefined, opportunity_id: oid }, { silent: true });
      if (note.trim()) await run("post", "/comments", { target_type: "opportunity", target_id: oid, body: note.trim() }, { silent: true });
    },
    () => errorsOf({ person: !person.text.trim() && m.form.pickPerson }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField label={m.shared.title} hint={m.form.titleHint} value={title} onChange={setTitle} placeholder={m.form.createTitlePlaceholder} />
      <ComboField name="person" label={m.shared.person} req half value={person} onChange={pickPerson} options={personOptions} placeholder={m.form.personNamePlaceholder} newLabel={m.shared.newPerson} />
      <ComboField label={m.shared.company} half value={company} onChange={setCompany} options={companyOptions} placeholder={m.form.companyPlaceholder} newLabel={m.form.newCompany} />
      {live.length ? (
        <ChipsField label={m.shared.source} value={String(src?.id ?? "")} onChange={(v) => v && setSourceId(v)} options={live.map((s) => ({ value: String(s.id), label: s.name }))} />
      ) : (
        <TextField label={m.shared.source} value={newSource} onChange={setNewSource} placeholder={m.form.noSource} />
      )}
      {isRef ? <ComboField label={m.form.referrer} value={referrer} onChange={setReferrer} options={personOptions} placeholder={m.form.personPlaceholder} /> : null}
      <SourceLinkFields url={url} setUrl={setUrl} date={srcDate} setDate={setSrcDate} />
      <ChipsField label={m.shared.stage} value={stage} onChange={(v) => v && setStage(v)} options={STAGE_OPTIONS} />
      <NumField label={m.form.value} half prefix={m.shared.currency} step={VALUE_STEP} value={value} onChange={setValue} />
      <DateField label={m.form.nextDate} half quick value={date} onChange={setDate} placeholder={m.form.nextDatePlaceholder} />
      <TextField label={m.form.nextStep} value={step} onChange={setStep} placeholder={m.form.titlePlaceholder} />
      <AreaField label={m.form.firstComment} opt value={note} onChange={setNote} placeholder={m.form.firstCommentPlaceholder} rows={3} />
    </Form>
  );
}
