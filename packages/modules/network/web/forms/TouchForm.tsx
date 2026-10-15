// The touch form of the sheet (a touch to a person, a company or an address only; editing one)
import { useEffect, useMemo, useState } from "react";
import { useCompanies, useIdeas, useOpps, usePeople } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Detail, Touch } from "@kit/api/types";
import { Form, Note } from "@kit/components/forms/Form";
import { AreaField, ChipsField, DateField, SegField, TextField, ToggleField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import { STAGE, CHANNEL, CHANNELS } from "@kit/lib/labels";
import { ensureCompany, ensurePerson, localToIso, nowLocal, toLocal, useRefText, type Ref } from "@kit/forms/helpers";
import { errorsOf, saveRecord, useCompanyOptions, usePersonOptions, useSubmit, type FormProps } from "@kit/forms/shared";

type Target = "person" | "company" | "contact";
const TARGETS = [{ value: "person" as const, label: "Kişi" }, { value: "company" as const, label: "Firma" }, { value: "contact" as const, label: "Sadece adres" }];
const DIRECTIONS = [{ value: "giden" as const, label: "Giden" }, { value: "gelen" as const, label: "Gelen" }];
const KINDS = [{ value: "mesaj" as const, label: "Mesaj" }, { value: "arama" as const, label: "Arama" }, { value: "gorusme" as const, label: "Görüşme" }];
const CHANNEL_OPTIONS = CHANNELS.map((c) => ({ value: c, label: CHANNEL[c] }));
const WAIT_HINT = "Cevap gelmezse takip zamanında Bugün dokun listesine düşer";

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
      const subject = target === "person" ? { person_id: await ensurePerson(person, { tags: ["aday"] }) }
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
      who: !(target === "person" ? person.text : target === "company" ? company.text : contact).trim() && "Kime yazdığını seç",
      summary: !summary.trim() && "Ne konuşulduğunu yaz",
    }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <SegField label="Kime" options={TARGETS} value={target} onChange={setTarget} />
      {target === "person" ? (
        <ComboField name="who" label="Kişi" req value={person} onChange={(v) => (setPerson(v), setOppId(""))} options={personOptions} placeholder="Kişi ara" newLabel="Yeni kişi" />
      ) : target === "company" ? (
        <ComboField name="who" label="Firma" req value={company} onChange={setCompany} options={companyOptions} placeholder="Firma ara ya da yeni yaz" newLabel="Yeni firma" />
      ) : (
        <TextField name="who" label="E-posta adresi ya da hesap" req value={contact} onChange={setContact} placeholder="info@firma.com ya da @hesap"
          hint="Cevap gelince tek tıkla kişiye ya da firmaya dönüştürürsün; o adresle kayıt açılınca temas ona bağlanır." />
      )}
      {personOpps.length ? (
        <ChipsField
          label="Fırsat"
          hint="Boşsa tek açık fırsat varsa ona bağlanır"
          clearable
          value={oppId}
          onChange={setOppId}
          options={personOpps.map((o) => ({ value: String(o.id), label: `${o.title} · ${STAGE[o.stage]}` }))}
        />
      ) : null}
      <ChipsField label="Kanal" value={channel} onChange={(v) => v && setChannel(v)} options={CHANNEL_OPTIONS} />
      <SegField label="Yön" half options={DIRECTIONS} value={direction} onChange={setDirection} />
      <DateField label="Tarih" half quick withTime value={at} onChange={setAt} />
      <SegField label="Tür" options={KINDS} value={kind} onChange={(k) => (setKind(k), setWait(k === "mesaj"))} />
      <AreaField name="summary" label="Ne konuşuldu" req value={summary} onChange={setSummary} placeholder="Kısa yaz ya da konuş" rows={4} />
      {direction === "giden" ? <ToggleField label="Cevap bekliyorum" hint={WAIT_HINT} value={wait} onChange={setWait} /> : null}
      {ideas.rows.length && target === "person" ? (
        <ComboField label="Bir fikir anlattıysan" opt value={idea} onChange={setIdea} options={ideaOptions} placeholder="Fikir ara" />
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
    () => errorsOf({ summary: !summary.trim() && "Ne konuşulduğunu yaz" }),
  );
  if (!t) return null;
  return (
    <Form id={p.formId} onSubmit={submit}>
      <Note>{t.direction === "gelen" ? "Gelen" : "Giden"} · {t.to_name}</Note>
      <ChipsField label="Kanal" value={channel} onChange={(v) => v && setChannel(v)} options={CHANNEL_OPTIONS} />
      <SegField label="Tür" options={KINDS} value={kind} onChange={setKind} />
      <DateField label="Tarih" quick withTime value={at} onChange={setAt} />
      <AreaField name="summary" label="Ne konuşuldu" req value={summary} onChange={setSummary} rows={4} />
      <TextField label="Sonuç" opt value={outcome} onChange={setOutcome} placeholder="Örn. teklif istedi" />
      {t.direction === "giden" ? <ToggleField label="Cevap bekliyorum" hint={WAIT_HINT} value={wait} onChange={setWait} /> : null}
    </Form>
  );
}
