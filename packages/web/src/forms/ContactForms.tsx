// Person, company and touch forms of the sheet
import { useEffect, useMemo, useState } from "react";
import { useCompanies, useIdeas, useOpps, usePeople, usePosts, useTags } from "../api/keys";
import { useQuery } from "../api/store";
import type { Company, Detail, Person, Touch } from "../api/types";
import { Form, Note } from "../components/forms/Form";
import { AreaField, ChipsField, DateField, SegField, TextField, ToggleField } from "../components/forms/fields";
import { ComboField } from "../components/forms/fields-rich";
import { PLATFORM, STAGE, CHANNEL, CHANNELS } from "../lib/labels";
import { todayIso } from "../lib/format";
import { emptyRef, ensureCompany, ensurePerson, localToIso, nowLocal, toLocal, type Ref } from "./helpers";
import { companyLinkedin, instagram as ig, leadFor, personLinkedin, website } from "./handles";
import { useLabels } from "./pickers";
import { badEmail, errorsOf, saveRecord, useCompanyOptions, usePersonOptions, useSubmit, type FormProps } from "./shared";

const EMAIL_ERROR = "Geçerli bir e-posta yaz";

/** Adres (e-posta ya da hesap) → form alanları: dönüştürmede önceden doldurulur */
function fromContact(contact?: string) {
  const c = contact?.trim() ?? "";
  if (!c) return {};
  if (/linkedin\.com/i.test(c)) return { linkedin: c };
  if (/instagram\.com/i.test(c) || c.startsWith("@")) return { instagram: c };
  if (c.includes("@")) return { email: c };
  return { handle: c };
}

/** Fill the text of a chosen record's reference once the list has loaded (opened with an id preset) */
function useRefText(ref: Ref, set: (r: Ref) => void, nameOf: (id: number) => string | undefined) {
  useEffect(() => {
    if (ref.id && !ref.text) {
      const name = nameOf(ref.id);
      if (name) set({ id: ref.id, text: name });
    }
  }, [ref, set, nameOf]);
}

// ---------------------------------------------------------------- kişi
export function PersonForm(p: FormProps) {
  const pre = p.sheet.preset;
  const editId = pre?.person_id;
  const existing = useQuery<Detail<Person>>(editId ? `/people/${editId}` : null);
  const companies = useCompanies();
  const companyOptions = useCompanyOptions();
  const personOptions = usePersonOptions();
  const conv = fromContact(pre?.contact);

  const [name, setName] = useState("");
  const [company, setCompany] = useState<Ref>(() => ({ id: pre?.company_id ?? null, text: "" }));
  const [role, setRole] = useState("");
  const [email, setEmail] = useState(conv.email ?? "");
  const [phone, setPhone] = useState("");
  const [handle, setHandle] = useState(conv.handle ?? "");
  const [instagram, setInstagram] = useState(ig.show(conv.instagram));
  const [linkedin, setLinkedin] = useState(personLinkedin.show(conv.linkedin));
  const [referrer, setReferrer] = useState<Ref>(emptyRef);
  const [follow, setFollow] = useState("");
  const [notes, setNotes] = useState("");
  const posts = usePosts();
  const [postRef, setPostRef] = useState<Ref>(emptyRef);
  const row = existing.data?.row;
  const tags = useTags();
  const aday = tags.rows.find((t) => t.slug === "aday" && !t.deleted_at)?.id;
  const labels = useLabels(row, { tags: aday ? [aday] : [] });
  const referrerOptions = useMemo(() => personOptions.filter((o) => o.id !== editId), [personOptions, editId]);
  const postOptions = useMemo(() => posts.rows.map((x) => ({ id: x.id, label: x.title, sub: PLATFORM[x.platform] })), [posts.rows]);

  useRefText(company, setCompany, (id) => companies.byId.get(id)?.name);
  useRefText(postRef, setPostRef, (id) => posts.byId.get(id)?.title);
  useEffect(() => {
    if (pre?.post_id) setPostRef({ id: pre.post_id, text: "" });
  }, [pre?.post_id]);
  useEffect(() => {
    if (!row) return;
    setName(row.name);
    setCompany({ id: row.company_id, text: row.company_name ?? "" });
    setRole(row.role ?? "");
    setEmail(row.email ?? "");
    setPhone(row.phone ?? "");
    setHandle(row.handle ?? "");
    setInstagram(ig.show(row.instagram));
    setLinkedin(personLinkedin.show(row.linkedin));
    setReferrer({ id: row.referred_by_id, text: row.referred_by_name ?? "" });
    setFollow(row.next_follow_up_at ?? "");
    setNotes(row.notes ?? "");
    setPostRef({ id: row.post_id, text: "" });
  }, [row]);

  const submit = useSubmit(
    p,
    async () => {
      const company_id = await ensureCompany(company);
      const body = {
        name: name.trim(), company_id, role, email, phone, handle, instagram: ig.save(instagram), linkedin: personLinkedin.save(linkedin), ...labels.body,
        referred_by_id: referrer.id, next_follow_up_at: follow || null, notes,
        post_id: postRef.id,
      };
      await saveRecord(p, editId, body, { ...body, next_follow_up_at: follow || undefined });
    },
    () => errorsOf({ name: !name.trim() && "Ad gerekli", email: badEmail(email) && EMAIL_ERROR, follow: !editId && !!follow && follow < todayIso() && "Geçmiş bir tarih olamaz" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="name" label="Ad soyad" req value={name} onChange={setName} placeholder="Örn. Zeynep Öztürk" autoFocus />
      <ComboField label="Firma" half value={company} onChange={setCompany} options={companyOptions} placeholder="Firma ara" newLabel="Yeni firma" />
      <TextField label="Rol" half value={role} onChange={setRole} placeholder="Örn. Kurucu" />
      <TextField name="email" label="E-posta" half type="email" value={email} onChange={setEmail} placeholder="ad@firma.com" />
      <TextField label="Telefon" half type="tel" value={phone} onChange={setPhone} placeholder="05xx xxx xx xx" />
      <TextField label="Instagram" half prefix={leadFor(instagram, "@")} value={instagram} onChange={setInstagram} />
      <TextField label="LinkedIn" half opt prefix={leadFor(linkedin, "in/")} value={linkedin} onChange={setLinkedin} placeholder="kullanıcı adı" />
      {labels.sourceField}
      <ComboField label="Kim tanıttı" opt value={referrer} onChange={setReferrer} options={referrerOptions} placeholder="Kişi ara" />
      <DateField name="follow" label="Sonraki takip tarihi" half opt quick value={follow} onChange={setFollow} placeholder="Örn. 17 Ekim" />
      <TextField label="Diğer hesap (R10 vb.)" half opt value={handle} onChange={setHandle} />
      {labels.statusField}
      {posts.rows.length ? (
        <ComboField label="Kaynak paylaşım" opt hint="Bu kişi hangi paylaşımdan geldi" value={postRef} onChange={setPostRef} options={postOptions} placeholder="Paylaşım ara" />
      ) : null}
      {labels.tagsField}
      {labels.sectorsField}
      <AreaField label="Not" value={notes} onChange={setNotes} placeholder="Kendine not" rows={3} />
    </Form>
  );
}

// ---------------------------------------------------------------- firma
export function CompanyForm(p: FormProps) {
  const pre = p.sheet.preset;
  const editId = pre?.edit;
  const existing = useQuery<Detail<Company>>(editId ? `/companies/${editId}` : null);
  const row = existing.data?.row;
  const conv = fromContact(pre?.contact);
  const [name, setName] = useState("");
  const [site, setSite] = useState(conv.email ? (conv.email.split("@")[1] ?? "") : "");
  const [email, setEmail] = useState(conv.email ?? "");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState(ig.show(conv.instagram));
  const [linkedin, setLinkedin] = useState(companyLinkedin.show(conv.linkedin));
  const [notes, setNotes] = useState("");
  const labels = useLabels(row);
  useEffect(() => {
    if (!row) return;
    setName(row.name);
    setSite(website.show(row.website));
    setEmail(row.email ?? "");
    setPhone(row.phone ?? "");
    setInstagram(ig.show(row.instagram));
    setLinkedin(companyLinkedin.show(row.linkedin));
    setNotes(row.notes ?? "");
  }, [row]);

  const submit = useSubmit(
    p,
    async () => {
      const body = { name: name.trim(), website: website.save(site), email, phone, instagram: ig.save(instagram), linkedin: companyLinkedin.save(linkedin), notes, ...labels.body };
      await saveRecord(p, editId, body);
    },
    () => errorsOf({ name: !name.trim() && "Firma adı gerekli", email: badEmail(email) && EMAIL_ERROR }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="name" label="Firma adı" req value={name} onChange={setName} autoFocus />
      <TextField label="Web" half prefix={leadFor(site, "https://")} value={site} onChange={setSite} placeholder="firma.com" />
      <TextField name="email" label="E-posta" half type="email" value={email} onChange={setEmail} placeholder="info@firma.com" />
      <TextField label="Telefon" half type="tel" value={phone} onChange={setPhone} />
      <TextField label="Instagram" half prefix={leadFor(instagram, "@")} value={instagram} onChange={setInstagram} />
      <TextField label="LinkedIn" half opt prefix={leadFor(linkedin, "company/")} value={linkedin} onChange={setLinkedin} />
      {labels.sourceField}
      {labels.statusField}
      {labels.tagsField}
      {labels.sectorsField}
      <AreaField label="Not" value={notes} onChange={setNotes} placeholder="Firmayla ilgili not" rows={3} />
    </Form>
  );
}

// ---------------------------------------------------------------- temas
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
