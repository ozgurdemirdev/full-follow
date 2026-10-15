// The draft form of the sheet (with template suggestions)
import { useEffect, useMemo, useState } from "react";
import { api } from "@kit/api/client";
import { useCompanies, usePeople } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Detail, Template } from "@kit/api/types";
import { Form, Note } from "@kit/components/forms/Form";
import { AreaField, ChipsField, Field, SegField, TextField } from "@kit/components/forms/fields";
import { ComboField, SuggField, type Suggestion } from "@kit/components/forms/fields-rich";
import { emptyRef, ensureCompany, ensurePerson, type Ref } from "@kit/forms/helpers";
import { CHANNEL_OPTIONS, errorsOf, saveRecord, useCompanyOptions, usePersonOptions, useSubmit, type FormProps } from "@kit/forms/shared";
import { TEMPLATE_KIND } from "@kit/lib/labels";

const TOKENS = ["{ad}", "{firma}"];
const SUGGESTED = 8;
const EMAIL_CHANNEL = "email";
const TO_KINDS = [{ value: "person" as const, label: "Kişi" }, { value: "company" as const, label: "Firma" }];

export function DraftForm(p: FormProps) {
  const pre = p.sheet.preset;
  // firmaya giden taslak (info@ gibi): {ad} ve {firma} firma adıyla dolar
  const companies = useCompanies();
  const company = pre?.company_id ? companies.byId.get(pre.company_id) : undefined;
  const people = usePeople();
  const personOptions = usePersonOptions();
  const companyOptions = useCompanyOptions(true);
  const [toKind, setToKind] = useState<"person" | "company">("person");
  const [toCompany, setToCompany] = useState<Ref>(emptyRef);
  const [person, setPerson] = useState<Ref>(() => ({ id: pre?.person_id ?? null, text: "" }));
  useEffect(() => {
    if (person.id && !person.text) {
      const x = people.byId.get(person.id);
      if (x) setPerson({ id: x.id, text: x.name });
    }
  }, [people.byId, person]);
  const known = person.id ? people.byId.get(person.id) : undefined;
  const [channel, setChannel] = useState(pre?.channel ?? "");
  const ch = channel || known?.last_channel || "email";
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [subjectLine, setSubjectLine] = useState("");
  const [body, setBody] = useState("");
  const [reason, setReason] = useState("");

  // kişiye ve kanala uyan şablonlar (en uygun önce); kişi seçilmemişse kanalın şablonları
  const companyId = pre?.company_id ?? (toKind === "company" ? toCompany.id : null);
  const subject = companyId ? `company_id=${companyId}` : toKind === "person" && person.id ? `person_id=${person.id}` : "";
  const sug = useQuery<Template[]>(subject ? `/templates/suggest?${subject}&channel=${ch}` : null);
  const all = useQuery<{ rows: Template[] }>(subject ? null : `/templates?channel=${ch}&limit=50`);
  const list = (subject ? sug.data : all.data?.rows) ?? [];
  const suggestions = useMemo(
    () => list.slice(0, SUGGESTED).map((t): Suggestion => ({
      key: t.id,
      name: t.name,
      meta: `${TEMPLATE_KIND[t.kind]}${t.sector_path ? ` · ${t.sector_path}` : ""}`,
      rate: t.sent ? t.replied / t.sent : null,
    })),
    [list],
  );

  const pick = async (t: Pick<Template, "id" | "body">) => {
    setTemplateId(t.id);
    if (!subject) return setBody(t.body);
    try {
      const r = await api.get<{ body: string }>(`/templates/${t.id}/render?${subject}`);
      setBody(r.body);
    } catch {
      setBody(t.body);
    }
  };

  // opened from a template card: apply it, and again for each newly chosen recipient
  const preTemplate = useQuery<Detail<Template>>(pre?.template_id ? `/templates/${pre.template_id}` : null);
  useEffect(() => {
    const t = preTemplate.data?.row;
    if (t && templateId === null) void pick(t);
  }, [preTemplate.data, subject, templateId]);

  const submit = useSubmit(
    p,
    async () => {
      const to = companyId || toKind === "company"
        ? { company_id: companyId ?? await ensureCompany(toCompany) }
        : { person_id: await ensurePerson(person, { tags: ["aday"] }) };
      await saveRecord(p, null, {
        ...to, channel: ch, subject: ch === EMAIL_CHANNEL ? subjectLine.trim() || undefined : undefined, body: body.trim(), template_id: templateId ?? undefined, reason: reason.trim() || undefined,
        opportunity_id: pre?.opportunity_id, project_id: pre?.project_id,
      });
    },
    () => errorsOf({
      to: !pre?.company_id && !(toKind === "company" ? toCompany.text : person.text).trim() && "Alıcıyı seç",
      body: !body.trim() && "Metin boş olamaz",
    }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      {pre?.company_id ? (
        <Note>Firmaya: {company?.name ?? ""}{company?.email ? ` · ${company.email}` : ""}</Note>
      ) : (
        <>
          <SegField label="Kime" options={TO_KINDS} value={toKind} onChange={(v) => (setToKind(v), setTemplateId(null))} />
          {toKind === "person" ? (
            <ComboField name="to" label="Alıcı" req value={person} onChange={(v) => (setPerson(v), setTemplateId(null))} options={personOptions} placeholder="Kişi ara" newLabel="Yeni kişi" />
          ) : (
            <ComboField name="to" label="Alıcı" req value={toCompany} onChange={(v) => (setToCompany(v), setTemplateId(null))} options={companyOptions} placeholder="Firma ara" newLabel="Yeni firma" />
          )}
        </>
      )}
      <ChipsField label="Kanal" value={ch} onChange={(v) => (v && setChannel(v), setTemplateId(null))} options={CHANNEL_OPTIONS} />
      {suggestions.length ? (
        <SuggField label="Şablon önerisi" hint="Uygun olan önce, seçince metne yazılır" options={suggestions} value={templateId} onPick={(s) => void pick(list.find((t) => t.id === s.key) ?? { id: Number(s.key), body: "" })} />
      ) : (
        <Field label="Şablon"><span className="form-hint">Bu kanal için şablon yok. Şablonlar sayfasından ekleyebilirsin.</span></Field>
      )}
      {ch === EMAIL_CHANNEL ? <TextField label="Konu" value={subjectLine} onChange={setSubjectLine} placeholder="E-postada görünür" /> : null}
      <AreaField name="body" label="Metin" req value={body} onChange={setBody} placeholder="Mesaj metni" rows={6} tokens={TOKENS} />
      <TextField label="Neden şimdi" opt value={reason} onChange={setReason} placeholder="Örn. paylaşıma yorum yaptı" />
    </Form>
  );
}
