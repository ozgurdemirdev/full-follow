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
import { m } from "../messages";

const ALL_TOKENS = ["{ad}", "{ad_soyad}", "{firma}", "{sektor}"];

const KIND_OPTIONS = TEMPLATE_KINDS.map((k) => ({ value: k, label: TEMPLATE_KIND[k] }));
const PREVIEW: Record<string, string> = { "{ad}": m.form.sampleFirstName, "{ad_soyad}": m.form.sampleFullName, "{firma}": m.form.sampleCompany, "{sektor}": m.form.sampleSector };

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
    () => errorsOf({ name: !name.trim() && m.form.nameRequired, body: !body.trim() && m.form.bodyRequired }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="name" label={m.form.name} req value={name} onChange={setName} placeholder={m.form.namePlaceholder} autoFocus />
      <SegField label={m.shared.kind} options={KIND_OPTIONS} value={kind} onChange={setKind} />
      <ChipsField label={m.shared.channel} hint={m.form.channelHint} clearable value={channel} onChange={setChannel} options={CHANNEL_OPTIONS} />
      <ComboField label={m.shared.sector} opt hint={m.form.sectorHint} value={sector} onChange={setSector} options={sectorOptions} placeholder={m.form.sectorPlaceholder} />
      <AreaField name="body" label={m.form.body} req value={body} onChange={setBody} placeholder={m.form.bodyPlaceholder} rows={5} tokens={ALL_TOKENS} hint={m.form.bodyHint} />
      {body.includes("{") ? (
        <Field label={m.form.preview}><p className="form-preview">{preview}</p></Field>
      ) : null}
    </Form>
  );
}
