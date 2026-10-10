// Kişi, firma ve temas formları + etiket, sektör, kaynak ve durum seçicileri
import { useEffect, useMemo, useState } from "react";
import { run } from "../api/actions";
import { pickable, useCompanies, useIdeas, useOpps, usePeople, usePosts, useSectors, useSources, useTags } from "../api/keys";
import { useQuery } from "../api/store";
import type { Company, Detail, Labeled, Person, Tag, Touch } from "../api/types";
import { Combo } from "../components/Combo";
import { ChipRadio, Field } from "../components/Sheet";
import { todayIso } from "../lib/format";
import { CHANNEL, CHANNELS, CONTACT_STATUS, CONTACT_STATUSES, PLATFORM, STAGE, TAG_CLS } from "../lib/labels";
import { emptyRef, ensureCompany, ensurePerson, localToIso, nowLocal, toLocal, type Ref } from "./helpers";
import { SubmitGuard, useSubmit, usePersonOptions, type FormProps } from "./QuickAdd";

// ---------------------------------------------------------------- seçiciler

/** Çoklu etiket seçimi; listede yoksa yazıp eklenir (yeni etiket açılır). Silinen etiket sadece zaten seçiliyse görünür. */
function TagPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const tags = useTags();
  const [name, setName] = useState("");
  const list = pickable(tags.rows, value);
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const hit = tags.rows.find((t) => t.name.toLocaleLowerCase("tr") === n.toLocaleLowerCase("tr") && !t.deleted_at);
    if (hit) {
      if (!value.includes(hit.id)) onChange([...value, hit.id]);
    } else {
      const r = await run<Tag>("post", "/tags", { name: n }).catch(() => null);
      if (r?.row) onChange([...value, r.row.id]);
    }
    setName("");
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3" role="group" aria-label="Etiketler">
        {list.map((t) => (
          <button key={t.id} type="button" aria-pressed={value.includes(t.id)} onClick={() => toggle(t.id)}
            className={`fchip h-control-height-xs ${value.includes(t.id) ? TAG_CLS[t.color] ?? "" : ""}`}>
            {t.name}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <input className="inp min-w-0 flex-1" placeholder="Yeni etiket (ör. fuar)" aria-label="Yeni etiket" value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void add())} />
        <button type="button" className="btn btn-sec" disabled={!name.trim()} onClick={() => void add()}>Ekle</button>
      </div>
    </div>
  );
}

/**
 * Sectors in two steps: pick a main sector, then (optionally) its sub-sectors.
 * A sub-sector stands in for its parent, so choosing one drops the parent from the value.
 * Missing sectors are typed in and sent as "Main > Sub" text; core creates them.
 */
function SectorPicker({ value, onChange, id }: { value: (number | string)[]; onChange: (v: (number | string)[]) => void; id: string }) {
  const sectors = useSectors();
  const ids = value.filter((v): v is number => typeof v === "number");
  const pending = value.filter((v): v is string => typeof v === "string");
  const options = pickable(sectors.rows, ids);
  const mains = options.filter((s) => !s.parent_id);
  const subsOf = (mainId: number) => options.filter((s) => s.parent_id === mainId);
  const [open, setOpen] = useState<number | null>(null);
  const [main, setMain] = useState("");
  const [sub, setSub] = useState("");
  const same = (a: string, b: string) => a.toLocaleLowerCase("tr") === b.toLocaleLowerCase("tr");
  const pickedSubs = (mainId: number) => subsOf(mainId).filter((s) => ids.includes(s.id));

  const toggleMain = (m: (typeof mains)[number]) => {
    if (pickedSubs(m.id).length) return setOpen(open === m.id ? null : m.id);
    if (ids.includes(m.id)) {
      onChange(value.filter((v) => v !== m.id));
      setOpen(null);
    } else {
      onChange([...value, m.id]);
      setOpen(m.id);
    }
  };
  const toggleSub = (s: (typeof options)[number]) =>
    onChange(ids.includes(s.id) ? value.filter((v) => v !== s.id) : [...value.filter((v) => v !== s.parent_id), s.id]);
  const addMain = () => {
    const t = main.trim();
    if (!t) return;
    const hit = mains.find((m) => same(m.name, t));
    if (hit) {
      if (!ids.includes(hit.id) && !pickedSubs(hit.id).length) onChange([...value, hit.id]);
      setOpen(hit.id);
    } else if (!pending.some((x) => same(x, t))) onChange([...value, t]);
    setMain("");
  };
  const addSub = (m: (typeof mains)[number]) => {
    const t = sub.trim();
    if (!t) return;
    const hit = subsOf(m.id).find((s) => same(s.name, t));
    const v = hit ? hit.id : `${m.name} > ${t}`;
    if (!value.includes(v)) onChange([...value.filter((x) => x !== m.id), v]);
    setSub("");
  };
  const opened = mains.find((m) => m.id === open);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3" role="group" aria-label="Ana sektörler">
        {mains.map((m) => {
          const n = pickedSubs(m.id).length;
          return (
            <button key={m.id} type="button" aria-pressed={ids.includes(m.id) || n > 0} aria-expanded={open === m.id} onClick={() => toggleMain(m)}
              className="fchip h-control-height-xs">
              {m.name}{n ? ` · ${n}` : ""}
            </button>
          );
        })}
        {pending.map((v) => (
          <button key={v} type="button" className="fchip h-control-height-xs" aria-pressed="true" onClick={() => onChange(value.filter((x) => x !== v))} title="Kaldır">
            {v} ×
          </button>
        ))}
      </div>
      {opened ? (
        <div className="inset flex flex-col gap-3 p-5">
          <span className="text-sm text-text-secondary">{opened.name} alt sektörleri (isteğe bağlı)</span>
          {subsOf(opened.id).length ? (
            <div className="flex flex-wrap gap-3" role="group" aria-label={`${opened.name} alt sektörleri`}>
              {subsOf(opened.id).map((s) => (
                <button key={s.id} type="button" aria-pressed={ids.includes(s.id)} onClick={() => toggleSub(s)} className="fchip h-control-height-xs">{s.name}</button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-3">
            <input className="inp min-w-0 flex-1" placeholder="Yeni alt sektör (ör. Motion designer)" aria-label="Yeni alt sektör" value={sub}
              onChange={(e) => setSub(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSub(opened))} />
            <button type="button" className="btn btn-sec" disabled={!sub.trim()} onClick={() => addSub(opened)}>Ekle</button>
          </div>
        </div>
      ) : null}
      <div className="flex gap-3">
        <input id={id} className="inp min-w-0 flex-1" placeholder="Yeni ana sektör (ör. Sağlık)" value={main}
          onChange={(e) => setMain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMain())} />
        <button type="button" className="btn btn-sec" disabled={!main.trim()} onClick={addMain}>Ekle</button>
      </div>
    </div>
  );
}

/** Nereden buldum: kaynak listesinden tek seçim */
function SourcePicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const sources = useSources();
  const list = pickable(sources.rows, value ? [value] : []);
  return (
    <ChipRadio label="Nereden buldum" value={String(value ?? "")} onChange={(v) => onChange(v ? Number(v) : null)}
      items={[{ value: "", label: "Belirtilmedi" }, ...list.map((s) => ({ value: String(s.id), label: s.name }))]} />
  );
}

function StatusPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <ChipRadio label="Temas durumu" value={value} onChange={onChange} items={CONTACT_STATUSES.map((s) => ({ value: s, label: CONTACT_STATUS[s] }))} />;
}

/** Kişi ve firmada ortak alanlar: etiket, sektör, kaynak, durum */
function useLabels(row: Labeled | undefined, defaults: { tags?: number[] } = {}) {
  const [tags, setTags] = useState<number[]>(defaults.tags ?? []);
  const [sectors, setSectors] = useState<(number | string)[]>([]);
  const [source, setSource] = useState<number | null>(null);
  const [status, setStatus] = useState("yazilmadi");
  useEffect(() => {
    if (!row) return;
    setTags(row.tag_ids);
    setSectors(row.sectors.map((s) => s.id));
    setSource(row.source_id);
    setStatus(row.contact_status);
  }, [row]);
  const body = { tags, sectors, source_id: source, contact_status: status };
  const fields = (prefix: string) => (
    <>
      <Field label="Etiketler"><TagPicker value={tags} onChange={setTags} /></Field>
      <Field label="Sektörler" htmlFor={`${prefix}-sector`}><SectorPicker id={`${prefix}-sector`} value={sectors} onChange={setSectors} /></Field>
      <Field label="Nereden buldum"><SourcePicker value={source} onChange={setSource} /></Field>
      <Field label="Temas durumu (temas ekleyince kendiliğinden ilerler)"><StatusPicker value={status} onChange={setStatus} /></Field>
    </>
  );
  return { body, fields };
}

/** Adres (e-posta ya da hesap) → form alanları: dönüştürmede önceden doldurulur */
function fromContact(contact?: string) {
  const c = contact?.trim() ?? "";
  if (!c) return {};
  if (/linkedin\.com/i.test(c)) return { linkedin: c };
  if (/instagram\.com/i.test(c) || c.startsWith("@")) return { instagram: c };
  if (c.includes("@")) return { email: c };
  return { handle: c };
}

// ---------------------------------------------------------------- kişi
export function PersonForm(p: FormProps) {
  const pre = p.sheet.preset;
  const editId = pre?.person_id;
  const existing = useQuery<Detail<Person>>(editId ? `/people/${editId}` : null);
  const companies = useCompanies();
  const personOptions = usePersonOptions();
  const companyOptions = useMemo(() => companies.rows.map((c) => ({ id: c.id, label: c.name })), [companies.rows]);
  const tags = useTags();
  const aday = tags.rows.find((t) => t.slug === "aday" && !t.deleted_at)?.id;
  const conv = fromContact(pre?.contact);

  const [name, setName] = useState("");
  const [company, setCompany] = useState<Ref>(() => ({ id: pre?.company_id ?? null, text: "" }));
  const [email, setEmail] = useState(conv.email ?? "");
  const [phone, setPhone] = useState("");
  const [handle, setHandle] = useState(conv.handle ?? "");
  const [instagram, setInstagram] = useState(conv.instagram ?? "");
  const [linkedin, setLinkedin] = useState(conv.linkedin ?? "");
  const [referrer, setReferrer] = useState<Ref>(emptyRef);
  const [follow, setFollow] = useState("");
  const [notes, setNotes] = useState("");
  const posts = usePosts();
  const [postId, setPostId] = useState(pre?.post_id ? String(pre.post_id) : "");
  const row = existing.data?.row;
  const labels = useLabels(row, { tags: aday ? [aday] : [] });

  useEffect(() => {
    if (company.id && !company.text) {
      const c = companies.byId.get(company.id);
      if (c) setCompany({ id: c.id, text: c.name });
    }
  }, [companies.byId, company]);
  useEffect(() => {
    if (!row) return;
    setName(row.name);
    setCompany({ id: row.company_id, text: row.company_name ?? "" });
    setEmail(row.email ?? "");
    setPhone(row.phone ?? "");
    setHandle(row.handle ?? "");
    setInstagram(row.instagram ?? "");
    setLinkedin(row.linkedin ?? "");
    setReferrer({ id: row.referred_by_id, text: row.referred_by_name ?? "" });
    setFollow(row.next_follow_up_at ?? "");
    setNotes(row.notes ?? "");
    setPostId(row.post_id ? String(row.post_id) : "");
  }, [row]);

  const submit = useSubmit(p, async () => {
    const company_id = await ensureCompany(company);
    const body = {
      name: name.trim(), company_id, email, phone, handle, instagram, linkedin, ...labels.body,
      referred_by_id: referrer.id, next_follow_up_at: follow || null, notes,
      post_id: postId ? Number(postId) : null,
    };
    if (editId) await run("patch", `/people/${editId}`, body, { ok: "Kişi güncellendi" });
    else await run("post", "/people", { ...body, next_follow_up_at: follow || undefined }, { ok: "Kişi eklendi" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Ad soyad" htmlFor="p-name">
          <input id="p-name" className="inp" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Firma" htmlFor="p-company">
          <Combo id="p-company" value={company} onChange={setCompany} options={companyOptions} placeholder="Firma adı" />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="E-posta" htmlFor="p-email">
          <input id="p-email" className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Telefon" htmlFor="p-phone">
          <input id="p-phone" className="inp" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Instagram" htmlFor="p-ig">
          <input id="p-ig" className="inp" placeholder="@kullaniciadi" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
        </Field>
        <Field label="LinkedIn" htmlFor="p-li">
          <input id="p-li" className="inp" placeholder="kullanıcı adı ya da adres" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
        </Field>
      </div>
      <Field label="Diğer hesap (R10 vb.)" htmlFor="p-handle">
        <input id="p-handle" className="inp" value={handle} onChange={(e) => setHandle(e.target.value)} />
      </Field>
      {labels.fields("p")}
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Kim tanıttı" htmlFor="p-ref">
          <Combo id="p-ref" value={referrer} onChange={setReferrer} options={personOptions.filter((o) => o.id !== editId)} placeholder="Kişi ara" allowNew={false} />
        </Field>
        <Field label="Sonraki takip tarihi" htmlFor="p-follow">
          <input id="p-follow" className="inp" type="date" min={editId ? undefined : todayIso()} value={follow} onChange={(e) => setFollow(e.target.value)} />
        </Field>
      </div>
      {posts.rows.length ? (
        <Field label="Kaynak paylaşım (bu kişi hangi paylaşımdan geldi)" htmlFor="p-post">
          <select id="p-post" className="inp" value={postId} onChange={(e) => setPostId(e.target.value)}>
            <option value="">Yok</option>
            {posts.rows.map((x) => <option key={x.id} value={x.id}>{PLATFORM[x.platform]} · {x.title}</option>)}
          </select>
        </Field>
      ) : null}
      <Field label="Not" htmlFor="p-notes">
        <textarea id="p-notes" className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </form>
  );
}

// ---------------------------------------------------------------- firma
export function CompanyForm(p: FormProps) {
  const pre = p.sheet.preset;
  const editId = pre?.edit;
  const existing = useQuery<Detail<Company>>(editId ? `/companies/${editId}` : null);
  const row = existing.data?.row;
  const conv = fromContact(pre?.contact);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState(conv.email ? conv.email.split("@")[1] ?? "" : "");
  const [email, setEmail] = useState(conv.email ?? "");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState(conv.instagram ?? "");
  const [linkedin, setLinkedin] = useState(conv.linkedin ?? "");
  const [notes, setNotes] = useState("");
  const labels = useLabels(row);
  useEffect(() => {
    if (!row) return;
    setName(row.name);
    setWebsite(row.website ?? "");
    setEmail(row.email ?? "");
    setPhone(row.phone ?? "");
    setInstagram(row.instagram ?? "");
    setLinkedin(row.linkedin ?? "");
    setNotes(row.notes ?? "");
  }, [row]);

  const submit = useSubmit(p, async () => {
    const body = { name: name.trim(), website, email, phone, instagram, linkedin, notes, ...labels.body };
    if (editId) await run("patch", `/companies/${editId}`, body, { ok: "Firma güncellendi" });
    else await run("post", "/companies", body, { ok: "Firma eklendi" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Firma adı" htmlFor="c-name">
          <input id="c-name" className="inp" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Web sitesi" htmlFor="c-web">
          <input id="c-web" className="inp" placeholder="firma.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Genel e-posta" htmlFor="c-email">
          <input id="c-email" className="inp" type="email" placeholder="info@firma.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Telefon" htmlFor="c-phone">
          <input id="c-phone" className="inp" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Instagram" htmlFor="c-ig">
          <input id="c-ig" className="inp" placeholder="@firma" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
        </Field>
        <Field label="LinkedIn" htmlFor="c-li">
          <input id="c-li" className="inp" placeholder="linkedin.com/company/firma" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
        </Field>
      </div>
      {labels.fields("c")}
      <Field label="Not" htmlFor="c-notes">
        <textarea id="c-notes" className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </form>
  );
}

// ---------------------------------------------------------------- temas
type Target = "person" | "company" | "contact";

export function TouchForm(p: FormProps) {
  const pre = p.sheet.preset;
  if (pre?.edit) return <TouchEdit {...p} id={pre.edit} />;
  return <TouchCreate {...p} />;
}

function TouchCreate(p: FormProps) {
  const personOptions = usePersonOptions();
  const companies = useCompanies();
  const companyOptions = useMemo(() => companies.rows.map((c) => ({ id: c.id, label: c.name, sub: c.email ?? c.website ?? undefined })), [companies.rows]);
  const opps = useOpps();
  const people = usePeople();
  const pre = p.sheet.preset;
  const [target, setTarget] = useState<Target>(pre?.company_id ? "company" : pre?.contact ? "contact" : "person");
  const [person, setPerson] = useState<Ref>(() => ({ id: pre?.person_id ?? null, text: "" }));
  const [company, setCompany] = useState<Ref>(() => ({ id: pre?.company_id ?? null, text: "" }));
  const [contact, setContact] = useState(pre?.contact ?? "");
  useEffect(() => {
    if (person.id && !person.text) {
      const x = people.byId.get(person.id);
      if (x) setPerson({ id: x.id, text: x.name });
    }
    if (company.id && !company.text) {
      const c = companies.byId.get(company.id);
      if (c) setCompany({ id: c.id, text: c.name });
    }
  }, [people.byId, person, companies.byId, company]);
  const [oppId, setOppId] = useState<string>(pre?.opportunity_id ? String(pre.opportunity_id) : "");
  const [channel, setChannel] = useState("email");
  const [direction, setDirection] = useState<Touch["direction"]>("giden");
  const [kind, setKind] = useState<Touch["kind"]>("mesaj");
  const [wait, setWait] = useState(true);
  const [summary, setSummary] = useState("");
  const [at, setAt] = useState(nowLocal());
  const ideas = useIdeas();
  const [ideaId, setIdeaId] = useState(pre?.idea_id ? String(pre.idea_id) : "");

  const personOpps = target === "person" && person.id ? opps.rows.filter((o) => o.person_id === person.id) : [];

  const submit = useSubmit(p, async () => {
    const subject = target === "person" ? { person_id: await ensurePerson(person, { tags: ["aday"] }) }
      : target === "company" ? { company_id: await ensureCompany(company) }
      : { contact: contact.trim() };
    await run("post", "/touches", {
      ...subject, channel, direction, kind, summary: summary.trim(),
      expects_reply: direction === "giden" ? wait : undefined,
      opportunity_id: oppId && target === "person" ? Number(oppId) : undefined,
      project_id: target === "person" ? pre?.project_id : undefined,
      happened_at: localToIso(at),
      idea_id: ideaId && target === "person" ? Number(ideaId) : undefined,
    }, { ok: "Temas kaydedildi" });
  });

  const ok = target === "person" ? !!person.text.trim() : target === "company" ? !!company.text.trim() : !!contact.trim();
  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <Field label="Kime">
        <ChipRadio label="Kime" value={target} onChange={setTarget}
          items={[{ value: "person" as const, label: "Kişi" }, { value: "company" as const, label: "Firma" }, { value: "contact" as const, label: "Sadece adres" }]} />
      </Field>
      {target === "person" ? (
        <Field label="Kişi" htmlFor="t-person">
          <Combo id="t-person" value={person} onChange={(v) => { setPerson(v); setOppId(""); }} options={personOptions} placeholder="Kişi ara" />
        </Field>
      ) : target === "company" ? (
        <Field label="Firma" htmlFor="t-company">
          <Combo id="t-company" value={company} onChange={setCompany} options={companyOptions} placeholder="Firma ara ya da yeni yaz" />
        </Field>
      ) : (
        <Field label="E-posta adresi ya da hesap" htmlFor="t-contact">
          <input id="t-contact" className="inp" placeholder="info@firma.com ya da @hesap" value={contact} onChange={(e) => setContact(e.target.value)} />
          <span className="text-sm text-text-muted">Cevap gelince tek tıkla kişiye ya da firmaya dönüştürürsün; o adresle kayıt açılınca temas ona bağlanır.</span>
        </Field>
      )}
      {personOpps.length ? (
        <Field label="Fırsat" htmlFor="t-opp">
          <select id="t-opp" className="inp" value={oppId} onChange={(e) => setOppId(e.target.value)}>
            <option value="">Otomatik (tek açık fırsat varsa ona bağlanır)</option>
            {personOpps.map((o) => <option key={o.id} value={o.id}>{o.title} · {STAGE[o.stage]}</option>)}
          </select>
        </Field>
      ) : null}
      <Field label="Yön">
        <ChipRadio label="Yön" items={[{ value: "giden" as const, label: "Ben yazdım" }, { value: "gelen" as const, label: "Bana yazdı" }]} value={direction} onChange={setDirection} />
      </Field>
      <TouchFields channel={channel} setChannel={setChannel} kind={kind} setKind={(k) => { setKind(k); setWait(k === "mesaj"); }} />
      {direction === "giden" ? <WaitBox wait={wait} setWait={setWait} /> : null}
      <Field label="Özet" htmlFor="t-summary">
        <textarea id="t-summary" className="inp" required value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Ne konuşuldu, ne yazıldı" />
      </Field>
      <Field label="Ne zaman" htmlFor="t-at">
        <input id="t-at" className="inp" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      </Field>
      {ideas.rows.length && target === "person" ? (
        <Field label="Bir fikir anlattıysan" htmlFor="t-idea">
          <select id="t-idea" className="inp" value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
            <option value="">Fikir yok</option>
            {ideas.rows.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select>
        </Field>
      ) : null}
      <SubmitGuard ok={ok} />
    </form>
  );
}

function TouchFields({ channel, setChannel, kind, setKind }: { channel: string; setChannel: (c: string) => void; kind: Touch["kind"]; setKind: (k: Touch["kind"]) => void }) {
  return (
    <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
      <Field label="Kanal" htmlFor="t-channel">
        <select id="t-channel" className="inp" value={channel} onChange={(e) => setChannel(e.target.value)}>
          {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL[c]}</option>)}
        </select>
      </Field>
      <Field label="Tür" htmlFor="t-kind">
        <select id="t-kind" className="inp" value={kind} onChange={(e) => setKind(e.target.value as Touch["kind"])}>
          <option value="mesaj">Mesaj</option>
          <option value="arama">Arama</option>
          <option value="gorusme">Görüşme</option>
        </select>
      </Field>
    </div>
  );
}

function WaitBox({ wait, setWait }: { wait: boolean; setWait: (w: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-base-sm text-text-body">
      <input type="checkbox" checked={wait} onChange={(e) => setWait(e.target.checked)} />
      Cevap bekliyorum (gelmezse Dashboard’da “Cevap bekleyenler”e düşer)
    </label>
  );
}

/** Temas düzenleme: muhatap ve yön değişmez (fırsat aşaması kuralı tekrar çalışmasın) */
function TouchEdit(p: FormProps & { id: number }) {
  const d = useQuery<Detail<Touch>>(`/touches/${p.id}`);
  const t = d.data?.row;
  const [channel, setChannel] = useState("email");
  const [kind, setKind] = useState<Touch["kind"]>("mesaj");
  const [wait, setWait] = useState(false);
  const [summary, setSummary] = useState("");
  const [outcome, setOutcome] = useState("");
  const [at, setAt] = useState("");
  useEffect(() => {
    if (!t) return;
    setChannel(t.channel);
    setKind(t.kind);
    setWait(t.expects_reply);
    setSummary(t.summary);
    setOutcome(t.outcome ?? "");
    setAt(toLocal(t.happened_at));
  }, [t]);
  const submit = useSubmit(p, async () => {
    await run("patch", `/touches/${p.id}`, {
      channel, kind, summary: summary.trim(), outcome, happened_at: localToIso(at),
      expects_reply: t?.direction === "giden" ? wait : undefined,
    }, { ok: "Temas güncellendi" });
  });
  if (!t) return null;
  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <p className="m-0 text-base text-text-secondary">{t.direction === "gelen" ? "Gelen" : "Giden"} · {t.to_name}</p>
      <TouchFields channel={channel} setChannel={setChannel} kind={kind} setKind={setKind} />
      {t.direction === "giden" ? <WaitBox wait={wait} setWait={setWait} /> : null}
      <Field label="Özet" htmlFor="te-summary">
        <textarea id="te-summary" className="inp" required value={summary} onChange={(e) => setSummary(e.target.value)} />
      </Field>
      <Field label="Sonuç" htmlFor="te-outcome">
        <input id="te-outcome" className="inp" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Örn. teklif istedi" />
      </Field>
      <Field label="Ne zaman" htmlFor="te-at">
        <input id="te-at" className="inp" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      </Field>
    </form>
  );
}
