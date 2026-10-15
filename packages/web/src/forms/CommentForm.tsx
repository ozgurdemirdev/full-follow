// The comment form of the sheet (comments are core: any record can take one)
import { useState } from "react";
import { run } from "../api/actions";
import { Form, Note } from "../components/forms/Form";
import { AreaField } from "../components/forms/fields";
import { ComboField } from "../components/forms/fields-rich";
import { comments } from "../messages.comments";
import { emptyRef, type Ref } from "./helpers";
import { errorsOf, useLinkOptions, useSubmit, type FormProps } from "./shared";

const m = comments.form;

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
      if (!t) throw new Error(m.noTarget);
      await run("post", "/comments", { target_type: t.type, target_id: t.id, body: body.trim() }, { ok: m.added });
    },
    () => errorsOf({ target: !preTarget && !target.id && m.pickTarget, body: !body.trim() && m.empty }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      {preTarget ? (
        <Note>{preTarget.label}</Note>
      ) : (
        <ComboField name="target" label={m.about} req value={target} onChange={setTarget} options={options} placeholder={m.aboutPlaceholder} />
      )}
      <AreaField name="body" label={m.body} req value={body} onChange={setBody} placeholder={m.bodyPlaceholder} rows={5} hint={m.bodyHint} />
    </Form>
  );
}
