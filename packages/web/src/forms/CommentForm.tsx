// The comment form of the sheet (comments are core: any record can take one)
import { useState } from "react";
import { run } from "../api/actions";
import { Form, Note } from "../components/forms/Form";
import { AreaField } from "../components/forms/fields";
import { ComboField } from "../components/forms/fields-rich";
import { emptyRef, type Ref } from "./helpers";
import { errorsOf, useLinkOptions, useSubmit, type FormProps } from "./shared";

export function CommentForm(p: FormProps) {
  const preTarget = p.sheet.preset?.target;
  const options = useLinkOptions();
  const [target, setTarget] = useState<Ref>(emptyRef);
  const [body, setBody] = useState("");

  const submit = useSubmit(
    p,
    async () => {
      const t = preTarget ?? (() => {
        const o = options.find((x) => x.id === target.id);
        return o ? { type: o.type, id: o.tid } : null;
      })();
      if (!t) throw new Error("hedef yok");
      await run("post", "/comments", { target_type: t.type, target_id: t.id, body: body.trim() }, { ok: "Yorum eklendi, Claude MCP’den görecek" });
    },
    () => errorsOf({ target: !preTarget && !target.id && "Neyle ilgili olduğunu seç", body: !body.trim() && "Yorum boş olamaz" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      {preTarget ? (
        <Note>{preTarget.label}</Note>
      ) : (
        <ComboField name="target" label="Neyle ilgili" req value={target} onChange={setTarget} options={options} placeholder="Fırsat, proje, kişi ya da firma ara" />
      )}
      <AreaField name="body" label="Yorum" req value={body} onChange={setBody} placeholder="Not ya da soru yaz" rows={5} hint="Özgür olarak yazıyorsun · Claude MCP’den okuyup cevaplar" />
    </Form>
  );
}
