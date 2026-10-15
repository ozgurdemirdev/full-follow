// The post form of the sheet
import { useEffect, useMemo, useState } from "react";
import { useIdeas } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { Detail, Post } from "@kit/api/types";
import { Form } from "@kit/components/forms/Form";
import { AreaField, ChipsField, DateField, NumField, SegField, TextField } from "@kit/components/forms/fields";
import { ComboField } from "@kit/components/forms/fields-rich";
import type { Ref } from "@kit/forms/helpers";
import { errorsOf, saveRecord, useSubmit, type FormProps } from "@kit/forms/shared";
import { todayIso } from "@kit/lib/format";
import { PLATFORM, type PostFormat } from "@kit/lib/labels";
import { PLATFORMS } from "../labels";
import { POST_FORMAT, POST_FORMATS } from "../labels";
import { useSettings } from "@kit/lib/settings";

const REFRESH_MAX_DAYS = 365;


/** Link as the record keeps it: with a scheme */
const withScheme = (v: string) => (!v.trim() || /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);
const showUrl = (v: string | null | undefined) => (v ?? "").replace(/^https:\/\//i, "");

const PLATFORM_DOT: Record<string, string> = {
  r10: "var(--color-entity-payment)", linkedin: "var(--color-entity-person)", instagram: "var(--color-entity-comment)", diger: "var(--color-entity-neutral)",
};
const PLATFORM_OPTIONS = PLATFORMS.map((x) => ({ value: x, label: PLATFORM[x], dot: PLATFORM_DOT[x] ?? PLATFORM_DOT.diger }));
const FORMAT_OPTIONS: { value: PostFormat | ""; label: string }[] = POST_FORMATS.map((value) => ({ value, label: POST_FORMAT[value] }));

export function PostForm(p: FormProps) {
  const editId = p.sheet.preset?.post_id;
  const existing = useQuery<Detail<Post>>(editId ? `/posts/${editId}` : null);
  const ideas = useIdeas();
  const refreshDays = useSettings().data?.post_refresh_days;
  const [platform, setPlatform] = useState("r10");
  const [format, setFormat] = useState<PostFormat | "">("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [postedAt, setPostedAt] = useState(todayIso());
  const [refresh, setRefresh] = useState<number | null>(null);
  const [idea, setIdea] = useState<Ref>(() => ({ id: p.sheet.preset?.idea_id ?? null, text: "" }));
  const [body, setBody] = useState("");
  const [notes, setNotes] = useState("");
  const ideaOptions = useMemo(() => ideas.rows.map((x) => ({ id: x.id, label: x.title })), [ideas.rows]);

  useEffect(() => {
    if (idea.id && !idea.text) {
      const x = ideas.byId.get(idea.id);
      if (x) setIdea({ id: x.id, text: x.title });
    }
  }, [ideas.byId, idea]);
  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setPlatform(row.platform);
    setFormat(row.format ?? "");
    setTitle(row.title);
    setUrl(showUrl(row.url));
    setPostedAt(row.posted_at.slice(0, 10));
    setRefresh(row.refresh_days ?? null);
    setIdea({ id: row.idea_id, text: "" });
    setBody(row.body ?? "");
    setNotes(row.notes ?? "");
  }, [row]);

  const submit = useSubmit(
    p,
    async () => {
      await saveRecord(p, editId, {
        platform, format: format || null, title: title.trim(), url: withScheme(url), posted_at: postedAt || undefined, body, notes,
        refresh_days: refresh ? Math.max(1, Math.round(refresh)) : null,
        idea_id: idea.id,
      });
    },
    () => errorsOf({ title: !title.trim() && "Başlık gerekli" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <ChipsField label="Platform" value={platform} onChange={(v) => v && setPlatform(v)} options={PLATFORM_OPTIONS} />
      <SegField label="Format" options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
      <TextField name="title" label="Başlık" req value={title} onChange={setTitle} placeholder="Örn. Kurumsal web sitesi yapıyorum" autoFocus />
      <AreaField label="Metin" opt value={body} onChange={setBody} rows={4} />
      <TextField label="Link" opt type="url" prefix="https://" value={url} onChange={setUrl} placeholder="instagram.com/p/..." />
      <DateField label="Paylaşım tarihi" half value={postedAt} onChange={setPostedAt} placeholder="Örn. 12 Ekim" />
      <NumField
        label="Güncelleme aralığı" half opt suffix="gün" max={REFRESH_MAX_DAYS} value={refresh} onChange={setRefresh}
        placeholder={refreshDays ? String(refreshDays) : undefined}
        hint={refreshDays ? `Bu kadar gün eskiyince hatırlatır, boşsa ayardaki ${refreshDays} gün` : "Bu kadar gün eskiyince hatırlatır"}
      />
      {ideas.rows.length ? <ComboField label="Tanıttığı fikir" opt value={idea} onChange={setIdea} options={ideaOptions} placeholder="Fikir ara" /> : null}
      <TextField label="Not" opt value={notes} onChange={setNotes} />
    </Form>
  );
}
