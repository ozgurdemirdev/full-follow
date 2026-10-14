// Marketing forms of the sheet: draft (with template suggestions), post, idea, message template
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useCompanies, useIdeas, useOwnProjects, usePeople, useSectors } from "../api/keys";
import { useQuery } from "../api/store";
import type { Detail, Idea, Post, Template } from "../api/types";
import { Form, Note } from "../components/forms/Form";
import { AreaField, ChipsField, DateField, NumField, SegField, TextField, Field } from "../components/forms/fields";
import { ComboField, SuggField, type Suggestion } from "../components/forms/fields-rich";
import { todayIso } from "../lib/format";
import { CHANNEL, CHANNELS, IDEA_STAGE, IDEA_STAGES, PLATFORM, PLATFORMS, PRIORITIES, PRIORITY, TEMPLATE_KIND, TEMPLATE_KINDS } from "../lib/labels";
import { emptyRef, ensureCompany, ensurePerson, type Ref } from "./helpers";
import { SectorTagsField } from "./pickers";
import { errorsOf, saveRecord, useCompanyOptions, usePersonOptions, useSubmit, type FormProps } from "./shared";

const CHANNEL_OPTIONS = CHANNELS.map((c) => ({ value: c, label: CHANNEL[c] }));
const TOKENS = ["{ad}", "{firma}"];
const ALL_TOKENS = ["{ad}", "{ad_soyad}", "{firma}", "{sektor}"];
const REFRESH_DEFAULT = 7;
const SUGGESTED = 8;

/** Link as the record keeps it: with a scheme */
const withScheme = (v: string) => (!v.trim() || /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);
const showUrl = (v: string | null | undefined) => (v ?? "").replace(/^https:\/\//i, "");

// ---------------------------------------------------------------- taslak
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
        ...to, channel: ch, body: body.trim(), template_id: templateId ?? undefined, reason: reason.trim() || undefined,
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
      <AreaField name="body" label="Metin" req value={body} onChange={setBody} placeholder="Mesaj metni" rows={6} tokens={TOKENS} />
      <TextField label="Neden şimdi" opt value={reason} onChange={setReason} placeholder="Örn. paylaşıma yorum yaptı" />
    </Form>
  );
}

// ---------------------------------------------------------------- paylaşım
const PLATFORM_DOT: Record<string, string> = {
  r10: "var(--color-entity-payment)", linkedin: "var(--color-entity-person)", instagram: "var(--color-entity-comment)", diger: "var(--color-entity-neutral)",
};
const PLATFORM_OPTIONS = PLATFORMS.map((x) => ({ value: x, label: PLATFORM[x], dot: PLATFORM_DOT[x] ?? PLATFORM_DOT.diger }));

export function PostForm(p: FormProps) {
  const editId = p.sheet.preset?.post_id;
  const existing = useQuery<Detail<Post>>(editId ? `/posts/${editId}` : null);
  const ideas = useIdeas();
  const [platform, setPlatform] = useState("r10");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [postedAt, setPostedAt] = useState(todayIso());
  const [refresh, setRefresh] = useState<number | null>(REFRESH_DEFAULT);
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
        platform, title: title.trim(), url: withScheme(url), posted_at: postedAt || undefined, body, notes,
        refresh_days: refresh ? Math.max(1, Math.round(refresh)) : null,
        idea_id: idea.id,
      });
    },
    () => errorsOf({ title: !title.trim() && "Başlık gerekli" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <ChipsField label="Platform" value={platform} onChange={(v) => { if (!v) return; setPlatform(v); if (!editId && !refresh && v === "r10") setRefresh(REFRESH_DEFAULT); }} options={PLATFORM_OPTIONS} />
      <TextField name="title" label="Başlık" req value={title} onChange={setTitle} placeholder="Örn. Kurumsal web sitesi yapıyorum" autoFocus />
      <AreaField label="Metin" opt value={body} onChange={setBody} rows={4} />
      <TextField label="Link" opt type="url" prefix="https://" value={url} onChange={setUrl} placeholder="instagram.com/p/..." />
      <DateField label="Paylaşım tarihi" half value={postedAt} onChange={setPostedAt} placeholder="Örn. 12 Ekim" />
      <NumField label="Güncelleme aralığı" half opt suffix="gün" hint="Bu kadar gün eskiyince hatırlatır, boş = hatırlatma yok" value={refresh} onChange={setRefresh} />
      {ideas.rows.length ? <ComboField label="Tanıttığı fikir" opt value={idea} onChange={setIdea} options={ideaOptions} placeholder="Fikir ara" /> : null}
      <TextField label="Not" opt value={notes} onChange={setNotes} />
    </Form>
  );
}

// ---------------------------------------------------------------- fikir
const PROJECT_NONE = "none";

export function IdeaForm(p: FormProps) {
  const editId = p.sheet.preset?.idea_id;
  const existing = useQuery<Detail<Idea>>(editId ? `/ideas/${editId}` : null);
  const ideas = useIdeas();
  const projects = useOwnProjects();
  const [projectId, setProjectId] = useState(p.sheet.preset?.own_project_id ? String(p.sheet.preset.own_project_id) : "");
  const [priority, setPriority] = useState("orta");
  const [parent, setParent] = useState<Ref>(emptyRef);
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [stage, setStage] = useState("fikir");
  const [sectors, setSectors] = useState<(number | string)[]>([]);
  const [notes, setNotes] = useState("");

  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setTitle(row.title);
    setProjectId(row.own_project_id ? String(row.own_project_id) : "");
    setPriority(row.priority);
    setParent({ id: row.parent_id, text: "" });
    setProblem(row.problem ?? "");
    setStage(row.stage);
    setSectors(row.sectors.map((s) => s.id));
    setNotes(row.notes ?? "");
  }, [row]);
  const parentOptions = useMemo(
    () => ideas.rows.filter((x) => !x.parent_id && !x.own_project_id && x.id !== editId).map((x) => ({ id: x.id, label: x.title })),
    [ideas.rows, editId],
  );
  useEffect(() => {
    if (parent.id && !parent.text) {
      const x = ideas.byId.get(parent.id);
      if (x) setParent({ id: x.id, text: x.title });
    }
  }, [ideas.byId, parent]);
  const where = useMemo(
    () => [{ value: PROJECT_NONE, label: "Para kazanma fikirleri" }, ...projects.rows.filter((x) => x.status !== "birakildi" || String(x.id) === projectId).map((x) => ({ value: String(x.id), label: x.name }))],
    [projects.rows, projectId],
  );

  const submit = useSubmit(
    p,
    async () => {
      // "Sağlık > Diş hekimi" yazılırsa eksik sektörler açılır
      // inside a project: priority only; general idea: stage, sectors and optional parent
      const data = projectId
        ? { title: title.trim(), problem, notes, own_project_id: Number(projectId), priority }
        : { title: title.trim(), problem, stage, notes, sectors, parent_id: parent.id, ...(row?.own_project_id ? { own_project_id: null } : {}) };
      await saveRecord(p, editId, data);
    },
    () => errorsOf({ title: !title.trim() && "Başlık gerekli" }),
  );

  return (
    <Form id={p.formId} onSubmit={submit}>
      <TextField name="title" label="Başlık" req value={title} onChange={setTitle} placeholder="Örn. klinik randevu botu" autoFocus />
      <ChipsField label="Nerede" value={projectId || PROJECT_NONE} onChange={(v) => v && setProjectId(v === PROJECT_NONE ? "" : v)} options={where} />
      <AreaField label={projectId ? "Açıklama" : "Çözdüğü sorun"} opt value={problem} onChange={setProblem} placeholder={projectId ? "Bu fikir ne yapacak" : "Kimin hangi derdini çözüyor"} rows={3} />
      {projectId ? (
        <SegField label="Öncelik" options={PRIORITIES.map((x) => ({ value: x, label: PRIORITY[x] }))} value={priority} onChange={setPriority} />
      ) : (
        <>
          <ChipsField label="Aşama" value={stage} onChange={(v) => v && setStage(v)} options={IDEA_STAGES.map((s) => ({ value: s, label: IDEA_STAGE[s] }))} />
          <SectorTagsField value={sectors} onChange={setSectors} />
          <ComboField label="Üst fikir" opt value={parent} onChange={setParent} options={parentOptions} placeholder="Bağlı olduğu fikir" />
        </>
      )}
      <AreaField label="Notlar" opt value={notes} onChange={setNotes} rows={3} />
    </Form>
  );
}

// ---------------------------------------------------------------- şablon
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
