// The message template form of the sheet
import { useEffect, useMemo, useState } from "react";
import { useSectors } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Detail, Template } from "@kit/api/types";
import { Form } from "@kit/components/forms/Form";
import { AreaField, ChipsField, Field, SegField, TextField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import { emptyRef, type Ref } from "@kit/forms/helpers";
import { CHANNEL_OPTIONS, errorsOf, saveRecord, useSubmit, type FormProps } from "@kit/forms/shared";
import { TEMPLATE_KIND } from "@kit/lib/labels";
import { TEMPLATE_KINDS } from "../labels";

const ALL_TOKENS = ["{ad}", "{ad_soyad}", "{firma}", "{sektor}"];

const KIND_OPTIONS = TEMPLATE_KINDS.map((k) => ({ value: k, label: TEMPLATE_KIND[k] }));
const PREVIEW: Record<string, string> = { "{ad}": "Ayşe", "{ad_soyad}": "Ayşe Demir", "{firma}": "Gülüş Diş", "{sektor}": "Diş hekimi" };

export function TemplateForm(p: FormProps) {
  const editId = p.sheet.preset?.template_id;
  const existing = useQuery<Detail<Template>>(editId ? `/templates/${editId}` : null);
  const sectors = useSectors();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("ilk");
  const [channel, setChannel] = useState("");
  const [sector, setSector] = useState<Ref>(emptyRef);
  const [body, setBody] = useState("");
  const sectorOptions = useMemo(() => sectors.rows.filter((x) => !x.deleted_at).map((x) => ({ id: x.id, label: x.path })), [sectors.rows]);

  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setName(row.name);
    setKind(row.kind);
    setChannel(row.channel ?? "");
    setSector({ id: row.sector_id, text: row.sector_path ?? "" });
    setBody(row.body);
  }, [row]);

  const preview = useMemo(() => ALL_TOKENS.reduce((text, t) => text.split(t).join(PREVIEW[t]), body), [body]);

  const submit = useSubmit(
    p,
    async () => {
      await saveRecord(p, editId, { name: name.trim(), kind, channel: channel || null, sector: sector.text.trim() || null, body });
    },
    () => errorsOf({ name: !name.trim() && "Şablon adı gerekli", body: !body.trim() && "Metin boş olamaz" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="name" label="Şablon adı" req value={name} onChange={setName} placeholder="Örn. Diş hekimi ilk mesaj" autoFocus />
      <SegField label="Tür" options={KIND_OPTIONS} value={kind} onChange={setKind} />
      <ChipsField label="Kanal" hint="Seçmezsen tüm kanallarda kullanılır" clearable value={channel} onChange={setChannel} options={CHANNEL_OPTIONS} />
      <ComboField label="Sektör" opt hint="Boş = hepsi, ya da Ana > Alt yaz" value={sector} onChange={setSector} options={sectorOptions} placeholder="Sağlık > Diş hekimi" />
      <AreaField name="body" label="Metin" req value={body} onChange={setBody} placeholder="Merhaba {ad}, {firma} için..." rows={5} tokens={ALL_TOKENS} hint="Gönderirken {ad} ve {firma} kişinin bilgisiyle dolar" />
      {body.includes("{") ? (
        <Field label="Önizleme"><p className="form-preview">{preview}</p></Field>
      ) : null}
    </Form>
  );
}
