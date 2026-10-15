// The person form of the sheet (add, edit the accounts, convert an address into a person)
import { useEffect, useMemo, useState } from "react";
import { useCompanies, usePosts, useTags } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Detail, Person } from "@kit/api/types";
import { Form } from "@kit/components/forms/Form";
import { AreaField, ChipsField, DateField, TextField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import { PLATFORM } from "@kit/lib/labels";
import { INFLUENCE_LABEL } from "../labels";
import { todayIso } from "@kit/lib/format";
import { emptyRef, ensureCompany, fromContact, useRefText, type Ref } from "@kit/forms/helpers";
import { instagram as ig, leadFor, personLinkedin } from "@kit/forms/handles";
import { useLabels } from "@kit/forms/pickers";
import { badEmail, errorsOf, saveRecord, useCompanyOptions, usePersonOptions, useSubmit, type FormProps } from "@kit/forms/shared";

const EMAIL_ERROR = "Geçerli bir e-posta yaz";
const INFLUENCE_OPTIONS = (Object.keys(INFLUENCE_LABEL) as (keyof typeof INFLUENCE_LABEL)[]).map((value) => ({ value, label: INFLUENCE_LABEL[value] }));

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
  const [influence, setInfluence] = useState<NonNullable<Person["influence"]> | "">("");
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
    setInfluence(row.influence ?? "");
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
        post_id: postRef.id, influence: influence || null,
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
      <ChipsField label="Karar rolü" opt clearable value={influence} onChange={setInfluence} options={INFLUENCE_OPTIONS} />
      {posts.rows.length ? (
        <ComboField label="Kaynak paylaşım" opt hint="Bu kişi hangi paylaşımdan geldi" value={postRef} onChange={setPostRef} options={postOptions} placeholder="Paylaşım ara" />
      ) : null}
      {labels.tagsField}
      {labels.sectorsField}
      <AreaField label="Not" value={notes} onChange={setNotes} placeholder="Kendine not" rows={3} />
    </Form>
  );
}