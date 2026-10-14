// Paket 2 formları: taslak (şablon önerili), paylaşım, fikir, mesaj şablonu
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { run } from "../api/actions";
import { useCompanies, useIdeas, useOwnProjects, usePeople, useSectors } from "../api/keys";
import { useQuery } from "../api/store";
import type { Detail, Idea, Post, Template } from "../api/types";
import { Combo } from "../components/Combo";
import { ChipRadio, Field } from "../components/Sheet";
import { Chip } from "../components/ui";
import { todayIso } from "../lib/format";
import { CHANNEL, CHANNELS, IDEA_STAGE, IDEA_STAGES, PLATFORM, PRIORITIES, PRIORITY, PLATFORMS, POST_FORMAT, POST_FORMATS, TEMPLATE_KIND, TEMPLATE_KINDS } from "../lib/labels";
import { useSettings } from "../lib/settings";
import { SubmitGuard, useSubmit, usePersonOptions, type FormProps } from "./QuickAdd";
import { emptyRef, ensureCompany, ensurePerson, type Ref } from "./helpers";

const PLACEHOLDERS = "{ad} {ad_soyad} {firma} {sektor}";

// ---------------------------------------------------------------- taslak
export function DraftForm(p: FormProps) {
  const pre = p.sheet.preset;
  // firmaya giden taslak (info@ gibi): {ad} ve {firma} firma adıyla dolar
  const companies = useCompanies();
  const company = pre?.company_id ? companies.byId.get(pre.company_id) : undefined;
  const people = usePeople();
  const personOptions = usePersonOptions();
  const companyOptions = useMemo(() => companies.rows.map((x) => ({ id: x.id, label: x.name, sub: x.email ?? undefined })), [companies.rows]);
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

  const submit = useSubmit(p, async () => {
    const to = companyId || toKind === "company"
      ? { company_id: companyId ?? await ensureCompany(toCompany) }
      : { person_id: await ensurePerson(person, { tags: ["aday"] }) };
    await run("post", "/drafts", {
      ...to, channel: ch, body: body.trim(), template_id: templateId ?? undefined, reason: reason.trim() || undefined,
      opportunity_id: pre?.opportunity_id, project_id: pre?.project_id,
    }, { ok: "Taslak onaya düştü" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      {pre?.company_id ? (
        <p className="m-0 text-base text-text-secondary">Firmaya: {company?.name ?? ""}{company?.email ? ` · ${company.email}` : ""}</p>
      ) : (
        <>
          <ChipRadio label="Kime" value={toKind} onChange={(v) => { setToKind(v); setTemplateId(null); }}
            items={[{ value: "person", label: "Kişi" }, { value: "company", label: "Firma" }]} />
          {toKind === "person" ? (
            <Field label="Kişi" htmlFor="d-person">
              <Combo id="d-person" value={person} onChange={(v) => { setPerson(v); setTemplateId(null); }} options={personOptions} placeholder="Kişi ara" />
            </Field>
          ) : (
            <Field label="Firma" htmlFor="d-company">
              <Combo id="d-company" value={toCompany} onChange={(v) => { setToCompany(v); setTemplateId(null); }} options={companyOptions} placeholder="Firma ara" />
            </Field>
          )}
        </>
      )}
      <Field label="Kanal" htmlFor="d-channel">
        <select id="d-channel" className="inp" value={ch} onChange={(e) => { setChannel(e.target.value); setTemplateId(null); }}>
          {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL[c]}</option>)}
        </select>
      </Field>
      <Field label={list.length ? "Şablon (uygun olan önce)" : "Şablon"}>
        {list.length ? (
          <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Şablon">
            {list.slice(0, 8).map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={templateId === t.id} className="fchip h-control-height-xs" onClick={() => pick(t)}
                title={t.sent ? `${t.replied}/${t.sent} dönüş` : undefined}>
                {t.name}
                <span className="text-text-muted"> · {TEMPLATE_KIND[t.kind]}{t.sector_path ? ` · ${t.sector_path}` : ""}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="text-base-sm text-text-muted">Bu kanal için şablon yok. Şablonlar sayfasından ekleyebilirsin.</span>
        )}
      </Field>
      <Field label="Metin" htmlFor="d-body">
        <textarea id="d-body" className="inp min-h-textarea-lg leading-relaxed" required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Mesaj metni" />
      </Field>
      <Field label="Neden şimdi (isteğe bağlı)" htmlFor="d-reason">
        <input id="d-reason" className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn. paylaşıma yorum yaptı" />
      </Field>
      <SubmitGuard ok={!!pre?.company_id || !!(toKind === "company" ? toCompany.text : person.text).trim()} />
    </form>
  );
}

// ---------------------------------------------------------------- paylaşım
export function PostForm(p: FormProps) {
  const editId = p.sheet.preset?.post_id;
  const existing = useQuery<Detail<Post>>(editId ? `/posts/${editId}` : null);
  const ideas = useIdeas();
  const [platform, setPlatform] = useState("r10");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [postedAt, setPostedAt] = useState(todayIso());
  const [refresh, setRefresh] = useState("");
  const [format, setFormat] = useState("");
  const defaultDays = useSettings().data?.post_refresh_days;
  const [ideaId, setIdeaId] = useState(p.sheet.preset?.idea_id ? String(p.sheet.preset.idea_id) : "");
  const [body, setBody] = useState("");
  const [notes, setNotes] = useState("");

  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setPlatform(row.platform);
    setTitle(row.title);
    setUrl(row.url ?? "");
    setPostedAt(row.posted_at.slice(0, 10));
    setRefresh(row.refresh_days ? String(row.refresh_days) : "");
    setFormat(row.format ?? "");
    setIdeaId(row.idea_id ? String(row.idea_id) : "");
    setBody(row.body ?? "");
    setNotes(row.notes ?? "");
  }, [row]);

  const submit = useSubmit(p, async () => {
    const data = {
      platform, title: title.trim(), url, posted_at: postedAt || undefined, body, notes,
      refresh_days: refresh ? Math.max(1, Math.round(Number(refresh))) : null, format: format || null,
      idea_id: ideaId ? Number(ideaId) : null,
    };
    if (editId) await run("patch", `/posts/${editId}`, data, { ok: "Paylaşım güncellendi" });
    else await run("post", "/posts", data, { ok: "Paylaşım eklendi" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <Field label="Platform">
        <ChipRadio label="Platform" items={PLATFORMS.map((x) => ({ value: x, label: PLATFORM[x] }))} value={platform} onChange={setPlatform} />
      </Field>
      <Field label="Biçim">
        <ChipRadio label="Biçim" items={[{ value: "", label: "Belirsiz" }, ...POST_FORMATS.map((x) => ({ value: x, label: POST_FORMAT[x] }))]} value={format} onChange={setFormat} />
      </Field>
      <Field label="Başlık" htmlFor="po-title">
        <input id="po-title" className="inp" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Kurumsal web sitesi yapıyorum" />
      </Field>
      <Field label="Bağlantı" htmlFor="po-url">
        <input id="po-url" className="inp" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
      </Field>
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Paylaşım tarihi" htmlFor="po-date">
          <input id="po-date" className="inp" type="date" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} />
        </Field>
        <Field label="Kaç günde bir güncellensin" htmlFor="po-refresh">
          <input id="po-refresh" className="inp font-mono" inputMode="numeric" value={refresh} onChange={(e) => setRefresh(e.target.value.replace(/\D/g, ""))} placeholder={defaultDays ? `boş = varsayılan (${defaultDays} gün)` : "boş = varsayılan"} />
        </Field>
      </div>
      {ideas.rows.length ? (
        <Field label="Tanıttığı fikir" htmlFor="po-idea">
          <select id="po-idea" className="inp" value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
            <option value="">Yok</option>
            {ideas.rows.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </Field>
      ) : null}
      <Field label="Metin (isteğe bağlı)" htmlFor="po-body">
        <textarea id="po-body" className="inp" value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <Field label="Not" htmlFor="po-notes">
        <input id="po-notes" className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </form>
  );
}

// ---------------------------------------------------------------- fikir
export function IdeaForm(p: FormProps) {
  const editId = p.sheet.preset?.idea_id;
  const existing = useQuery<Detail<Idea>>(editId ? `/ideas/${editId}` : null);
  const sectors = useSectors();
  const ideas = useIdeas();
  const projects = useOwnProjects();
  const [projectId, setProjectId] = useState(p.sheet.preset?.own_project_id ? String(p.sheet.preset.own_project_id) : "");
  const [priority, setPriority] = useState("orta");
  const [parentId, setParentId] = useState("");
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [stage, setStage] = useState("fikir");
  const [chosen, setChosen] = useState<string[]>([]);
  const [sectorText, setSectorText] = useState("");
  const [notes, setNotes] = useState("");
  const [moneyNote, setMoneyNote] = useState("");

  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setTitle(row.title);
    setMoneyNote(row.money_note ?? "");
    setProjectId(row.own_project_id ? String(row.own_project_id) : "");
    setPriority(row.priority);
    setParentId(row.parent_id ? String(row.parent_id) : "");
    setProblem(row.problem ?? "");
    setStage(row.stage);
    setChosen(row.sectors.map((s) => s.path));
    setNotes(row.notes ?? "");
  }, [row]);

  const addSector = () => {
    const v = sectorText.trim();
    if (v && !chosen.includes(v)) setChosen((c) => [...c, v]);
    setSectorText("");
  };

  const submit = useSubmit(p, async () => {
    const all = sectorText.trim() && !chosen.includes(sectorText.trim()) ? [...chosen, sectorText.trim()] : chosen;
    // "Sağlık > Diş hekimi" yazılırsa eksik sektörler açılır
    // inside a project: priority only; general idea: stage, sectors and optional parent
    const data = projectId
      ? { title: title.trim(), problem, notes, own_project_id: Number(projectId), priority }
      : { title: title.trim(), problem, money_note: moneyNote, stage, notes, sectors: all, parent_id: parentId ? Number(parentId) : null, ...(row?.own_project_id ? { own_project_id: null } : {}) };
    if (editId) await run("patch", `/ideas/${editId}`, data, { ok: "Fikir güncellendi" });
    else await run("post", "/ideas", data, { ok: "Fikir eklendi" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <Field label="Ürün fikri" htmlFor="i-title">
        <input id="i-title" className="inp" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. klinik randevu botu" />
      </Field>
      <Field label="Nerede" htmlFor="i-where">
        <select id="i-where" className="inp" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Para kazanma fikirleri</option>
          {projects.rows.filter((x) => x.status !== "birakildi" || String(x.id) === projectId).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      {projectId ? (
        <Field label="Öncelik">
          <ChipRadio label="Öncelik" items={PRIORITIES.map((x) => ({ value: x, label: PRIORITY[x] }))} value={priority} onChange={setPriority} />
        </Field>
      ) : (
        <Field label="Üst fikir (isteğe bağlı)" htmlFor="i-parent">
          <select id="i-parent" className="inp" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Yok, kendi başına bir fikir</option>
            {ideas.rows.filter((x) => !x.parent_id && !x.own_project_id && x.id !== editId).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </Field>
      )}
      <Field label={projectId ? "Açıklama" : "Çözdüğü sorun"} htmlFor="i-problem">
        <textarea id="i-problem" className="inp" value={problem} onChange={(e) => setProblem(e.target.value)} placeholder={projectId ? "Bu fikir ne yapacak" : "Kimin hangi derdini çözüyor"} />
      </Field>
      {projectId ? null : (
        <>
          <Field label="Para hesabı" htmlFor="i-money">
            <textarea id="i-money" className="inp" value={moneyNote} onChange={(e) => setMoneyNote(e.target.value)} placeholder="Nasıl para kazandırır: ₺2.500 × 10 klinik" />
          </Field>
          <Field label="Aşama">
            <ChipRadio label="Aşama" items={IDEA_STAGES.map((s) => ({ value: s, label: IDEA_STAGE[s] }))} value={stage} onChange={setStage} />
          </Field>
          <Field label="Hedef sektörler (Ana > Alt)" htmlFor="i-sector">
            <div className="flex gap-3">
              <input id="i-sector" className="inp min-w-0 flex-1" list="i-sector-list" value={sectorText} placeholder="Sağlık > Diş hekimi"
                onChange={(e) => setSectorText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSector())} />
              <button type="button" className="btn btn-sec" disabled={!sectorText.trim()} onClick={addSector}>Ekle</button>
            </div>
            <datalist id="i-sector-list">{sectors.rows.map((x) => <option key={x.id} value={x.path} />)}</datalist>
            {chosen.length ? (
              <div className="flex flex-wrap gap-2">
                {chosen.map((x) => (
                  <button key={x} type="button" className="chip bg-chip-neutral-bg text-chip-neutral-fg border-0" title="Kaldır" onClick={() => setChosen((c) => c.filter((y) => y !== x))}>
                    {x} ×
                  </button>
                ))}
              </div>
            ) : null}
          </Field>
        </>
      )}
      <Field label="Notlar" htmlFor="i-notes">
        <textarea id="i-notes" className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </form>
  );
}

// ---------------------------------------------------------------- şablon
export function TemplateForm(p: FormProps) {
  const editId = p.sheet.preset?.template_id;
  const existing = useQuery<Detail<Template>>(editId ? `/templates/${editId}` : null);
  const sectors = useSectors();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("ilk");
  const [channel, setChannel] = useState("");
  const [sector, setSector] = useState("");
  const [body, setBody] = useState("");

  const row = existing.data?.row;
  useEffect(() => {
    if (!row) return;
    setName(row.name);
    setKind(row.kind);
    setChannel(row.channel ?? "");
    setSector(row.sector_path ?? "");
    setBody(row.body);
  }, [row]);

  const preview = useMemo(() => body.replace(/\{ad\}/g, "Ayşe").replace(/\{ad_soyad\}/g, "Ayşe Demir").replace(/\{firma\}/g, "Gülüş Diş").replace(/\{sektor\}/g, "Diş hekimi"), [body]);

  const submit = useSubmit(p, async () => {
    const data = { name: name.trim(), kind, channel: channel || null, sector: sector.trim() || null, body };
    if (editId) await run("patch", `/templates/${editId}`, data, { ok: "Şablon güncellendi" });
    else await run("post", "/templates", data, { ok: "Şablon eklendi" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <Field label="Ad" htmlFor="tp-name">
        <input id="tp-name" className="inp" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Diş hekimi ilk mesaj" />
      </Field>
      <Field label="Tür">
        <ChipRadio label="Tür" items={TEMPLATE_KINDS.map((k) => ({ value: k, label: TEMPLATE_KIND[k] }))} value={kind} onChange={setKind} />
      </Field>
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Kanal" htmlFor="tp-channel">
          <select id="tp-channel" className="inp" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Tüm kanallar</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL[c]}</option>)}
          </select>
        </Field>
        <Field label="Sektör (boş = hepsi)" htmlFor="tp-sector">
          <input id="tp-sector" className="inp" list="tp-sector-list" value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Sağlık > Diş hekimi" />
          <datalist id="tp-sector-list">{sectors.rows.map((x) => <option key={x.id} value={x.path} />)}</datalist>
        </Field>
      </div>
      <Field label="Metin" htmlFor="tp-body">
        <textarea id="tp-body" className="inp min-h-textarea-lg leading-relaxed" required value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Merhaba {ad}, {firma} için..." />
        <span className="text-sm text-text-muted">Yer tutucular: {PLACEHOLDERS}</span>
      </Field>
      {body.includes("{") ? (
        <div className="flex flex-col gap-2">
          <Chip className="self-start">Önizleme</Chip>
          <p className="inset m-0 whitespace-pre-line px-6 py-5 text-base-sm leading-normal text-text-primary">{preview}</p>
        </div>
      ) : null}
    </form>
  );
}

