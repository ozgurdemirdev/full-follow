// The touch form of the sheet (a touch to a person, a company or an address only; editing one)
import { useEffect, useMemo, useState } from "react";
import { useCompanies, useIdeas, useOpps, usePeople } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Detail, Touch } from "@kit/api/types";
import { Form, Note } from "@kit/components/forms/Form";
import { AreaField, ChipsField, DateField, SegField, TextField, ToggleField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import { STAGE } from "@kit/lib/labels";
import { ensureCompany, ensurePerson, localToIso, nowLocal, toLocal, useRefText, type Ref } from "@kit/forms/helpers";
import { CHANNEL_OPTIONS, errorsOf, saveRecord, useCompanyOptions, usePersonOptions, useSubmit, type FormProps } from "@kit/forms/shared";
import { m } from "../messages";
import { m as kit } from "@kit/messages";

type Target = "person" | "company" | "contact";
const TARGETS = [{ value: "person" as const, label: m.formTargets.person }, { value: "company" as const, label: m.formTargets.company }, { value: "contact" as const, label: m.formTargets.contact }];
const DIRECTIONS = [{ value: "giden" as const, label: m.formDirections.giden }, { value: "gelen" as const, label: m.formDirections.gelen }];
const KINDS = [{ value: "mesaj" as const, label: m.formKinds.mesaj }, { value: "arama" as const, label: m.formKinds.arama }, { value: "gorusme" as const, label: m.formKinds.gorusme }];
const WAIT_HINT = m.form.waitHint;

export function TouchForm(p: FormProps) {
  const pre = p.sheet.preset;
  if (pre?.edit) return <TouchEdit {...p} id={pre.edit} />;
  return <TouchCreate {...p} />;
}

function TouchCreate(p: FormProps) {
  const personOptions = usePersonOptions();
  const companies = useCompanies();
  const companyOptions = useCompanyOptions(true);
  const opps = useOpps();
  const people = usePeople();
  const pre = p.sheet.preset;
  const [target, setTarget] = useState<Target>(pre?.company_id ? "company" : pre?.contact ? "contact" : "person");
  const [person, setPerson] = useState<Ref>(() => ({ id: pre?.person_id ?? null, text: "" }));
  const [company, setCompany] = useState<Ref>(() => ({ id: pre?.company_id ?? null, text: "" }));
  const [contact, setContact] = useState(pre?.contact ?? "");
  useRefText(person, setPerson, (id) => people.byId.get(id)?.name);
  useRefText(company, setCompany, (id) => companies.byId.get(id)?.name);
  const [oppId, setOppId] = useState<string>(pre?.opportunity_id ? String(pre.opportunity_id) : "");
  const [channel, setChannel] = useState("email");
  const [direction, setDirection] = useState<Touch["direction"]>("giden");
  const [kind, setKind] = useState<Touch["kind"]>("mesaj");
  const [wait, setWait] = useState(true);
  const [summary, setSummary] = useState("");
  const [at, setAt] = useState(nowLocal());
  const ideas = useIdeas();
  const [idea, setIdea] = useState<Ref>(() => ({ id: pre?.idea_id ?? null, text: "" }));
  useRefText(idea, setIdea, (id) => ideas.byId.get(id)?.title);
  const ideaOptions = useMemo(() => ideas.rows.map((x) => ({ id: x.id, label: x.title })), [ideas.rows]);

  const personOpps = target === "person" && person.id ? opps.rows.filter((o) => o.person_id === person.id) : [];

  const submit = useSubmit(
    p,
    async () => {
      const subject = target === "person" ? { person_id: await ensurePerson(person, { tags: [m.form.candidateTag] }) }
        : target === "company" ? { company_id: await ensureCompany(company) }
        : { contact: contact.trim() };
      await saveRecord(p, null, {
        ...subject, channel, direction, kind, summary: summary.trim(),
        expects_reply: direction === "giden" ? wait : undefined,
        opportunity_id: oppId && target === "person" ? Number(oppId) : undefined,
        project_id: target === "person" ? pre?.project_id : undefined,
        happened_at: localToIso(at),
        idea_id: idea.id && target === "person" ? idea.id : undefined,
      });
    },
    () => errorsOf({
      who: !(target === "person" ? person.text : target === "company" ? company.text : contact).trim() && m.form.pickTarget,
      summary: !summary.trim() && m.form.summaryRequired,
    }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <SegField label={m.form.to} options={TARGETS} value={target} onChange={setTarget} />
      {target === "person" ? (
        <ComboField name="who" label={kit.nouns.person} req value={person} onChange={(v) => (setPerson(v), setOppId(""))} options={personOptions} placeholder={m.form.personPlaceholder} newLabel={m.form.newPerson} />
      ) : target === "company" ? (
        <ComboField name="who" label={kit.nouns.company} req value={company} onChange={setCompany} options={companyOptions} placeholder={m.form.companyPlaceholder} newLabel={m.form.newCompany} />
      ) : (
        <TextField name="who" label={m.form.contact} req value={contact} onChange={setContact} placeholder={m.form.contactPlaceholder}
          hint={m.form.contactHint} />
      )}
      {personOpps.length ? (
        <ChipsField
          label={m.form.opportunity}
          hint={m.form.opportunityHint}
          clearable
          value={oppId}
          onChange={setOppId}
          options={personOpps.map((o) => ({ value: String(o.id), label: `${o.title} · ${STAGE[o.stage]}` }))}
        />
      ) : null}
      <ChipsField label={kit.fields.channel} value={channel} onChange={(v) => v && setChannel(v)} options={CHANNEL_OPTIONS} />
      <SegField label={m.form.direction} half options={DIRECTIONS} value={direction} onChange={setDirection} />
      <DateField label={kit.fields.date} half quick withTime value={at} onChange={setAt} />
      <SegField label={kit.fields.kind} options={KINDS} value={kind} onChange={(k) => (setKind(k), setWait(k === "mesaj"))} />
      <AreaField name="summary" label={m.form.what} req value={summary} onChange={setSummary} placeholder={m.form.whatPlaceholder} rows={4} />
      {direction === "giden" ? <ToggleField label={m.form.waiting} hint={WAIT_HINT} value={wait} onChange={setWait} /> : null}
      {ideas.rows.length && target === "person" ? (
        <ComboField label={m.form.idea} opt value={idea} onChange={setIdea} options={ideaOptions} placeholder={m.form.ideaPlaceholder} />
      ) : null}
    </Form>
  );
}

/** Temas düzenleme: muhatap ve yön değişmez (fırsat aşaması kuralı tekrar çalışmasın) */
function TouchEdit(p: FormProps & { id: number }) {
  const d = useQuery<Detail<Touch>>(`/touches/${p.id}`);
  const t = d.data?.row;
  const [channel, setChannel] = useState("email");
  const [kind, setKind] = useState<Touch["kind"]>("mesaj");
  const [wait, setWait] = useState(false);
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [at, setAt] = useState("");
  useEffect(() => {
    if (!t) return;
    setChannel(t.channel);
    setKind(t.kind);
    setWait(t.expects_reply);
    setSummary(t.summary);
    setOutcome(t.outcome ?? "");
    setAt(toLocal(t.happened_at));
  }, [t]);
  const submit = useSubmit(
    p,
    async () => {
      await saveRecord(p, p.id, {
        channel, kind, summary: summary.trim(), outcome, happened_at: localToIso(at),
        expects_reply: t?.direction === "giden" ? wait : undefined,
      });
    },
    () => errorsOf({ summary: !summary.trim() && m.form.summaryRequired }),
  );
  if (!t) return null;
  return (
    <Form id={p.formId} onSubmit={submit}>
      <Note>{t.direction === "gelen" ? m.form.incoming : m.form.outgoing} · {t.to_name}</Note>
      <ChipsField label={kit.fields.channel} value={channel} onChange={(v) => v && setChannel(v)} options={CHANNEL_OPTIONS} />
      <SegField label={kit.fields.kind} options={KINDS} value={kind} onChange={setKind} />
      <DateField label={kit.fields.date} quick withTime value={at} onChange={setAt} />
      <AreaField name="summary" label={m.form.what} req value={summary} onChange={setSummary} rows={4} />
      <TextField label={m.form.result} opt value={outcome} onChange={setOutcome} placeholder={m.form.resultPlaceholder} />
      {t.direction === "giden" ? <ToggleField label={m.form.waiting} hint={WAIT_HINT} value={wait} onChange={setWait} /> : null}
    </Form>
  );
}
