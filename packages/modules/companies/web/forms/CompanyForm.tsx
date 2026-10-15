// The company form of the sheet
import { useEffect, useState } from "react";
import { useQuery } from "@kit/api/store";
import type { Company, Detail } from "@kit/api/types";
import { Form } from "@kit/components/forms/Form";
import { AreaField, TextField } from "@kit/components/forms/fields";
import { fromContact } from "@kit/forms/helpers";
import { companyLinkedin, instagram as ig, leadFor, website } from "@kit/forms/handles";
import { useLabels } from "@kit/forms/pickers";
import { badEmail, errorsOf, saveRecord, useSubmit, type FormProps } from "@kit/forms/shared";

const EMAIL_ERROR = "Geçerli bir e-posta yaz";

export function CompanyForm(p: FormProps) {
  const pre = p.sheet.preset;
  const editId = pre?.edit;
  const existing = useQuery<Detail<Company>>(editId ? `/companies/${editId}` : null);
  const row = existing.data?.row;
  const conv = fromContact(pre?.contact);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
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
    setCity(row.city ?? "");
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
      const body = { name: name.trim(), city, website: website.save(site), email, phone, instagram: ig.save(instagram), linkedin: companyLinkedin.save(linkedin), notes, ...labels.body };
      await saveRecord(p, editId, body);
    },
    () => errorsOf({ name: !name.trim() && "Firma adı gerekli", email: badEmail(email) && EMAIL_ERROR }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="name" label="Firma adı" req value={name} onChange={setName} autoFocus />
      <TextField label="Şehir" half value={city} onChange={setCity} placeholder="Örn. İstanbul, Kadıköy" />
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