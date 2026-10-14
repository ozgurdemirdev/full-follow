import * as m from "motion/react-m";
import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { run } from "../api/actions";
import { pickable, useCompanies, useOpps, usePeople, useProjects, useSources } from "../api/keys";
import { useQuery } from "../api/store";
import type { Detail, Opportunity, Source, Task, TaskKind } from "../api/types";
import { closeSheet, useUI, type SheetState } from "../app/ui";
import { PATHS } from "../app/routes";
import { Combo, type Option } from "../components/Combo";
import { Icon } from "../components/icons";
import { NumberField } from "../components/NumberField";
import { ChipRadio, Field, Sheet } from "../components/Sheet";
import { addDaysIso, todayIso } from "../lib/format";
import { dur, ease, riseY } from "../lib/motion";
import { OPEN_STAGES, STAGE, TASK_KIND_ITEMS, type OppStage } from "../lib/labels";
import { emptyRef, ensurePerson, type Ref } from "./helpers";

const TITLES: Record<SheetState["kind"], string> = {
  opportunity: "Fırsat",
  person: "Kişi",
  company: "Firma",
  touch: "Temas",
  task: "Yeni görev",
  comment: "Yorum yaz",
  draft: "Taslak yaz",
  post: "Paylaşım",
  idea: "Fikir",
  template: "Mesaj şablonu",
  project: "Yeni proje",
  goal: "Günlük hedef",
  own_project: "Kendi projesi",
};

// Pazarlama formları ayrı parçada (ilk açılışta yüklenir)
const DraftForm = lazy(() => import("./MarketingForms").then((m) => ({ default: m.DraftForm })));
const PostForm = lazy(() => import("./MarketingForms").then((m) => ({ default: m.PostForm })));
const IdeaForm = lazy(() => import("./MarketingForms").then((m) => ({ default: m.IdeaForm })));
const TemplateForm = lazy(() => import("./MarketingForms").then((m) => ({ default: m.TemplateForm })));
// Kişi, firma ve temas formları (etiket, sektör ve kaynak seçicileriyle) ayrı parçada
const PersonForm = lazy(() => import("./ContactForms").then((m) => ({ default: m.PersonForm })));
const CompanyForm = lazy(() => import("./ContactForms").then((m) => ({ default: m.CompanyForm })));
const TouchForm = lazy(() => import("./ContactForms").then((m) => ({ default: m.TouchForm })));
const GoalForm = lazy(() => import("./GoalForm").then((m) => ({ default: m.GoalForm })));
const OwnProjectForm = lazy(() => import("./OwnProjectForm").then((m) => ({ default: m.OwnProjectForm })));
const ProjectForm = lazy(() => import("./ProjectForm").then((m) => ({ default: m.ProjectForm })));

/** Hızlı ekle menüsünden ya da sayfalardan açılan tüm formlar */
export default function QuickAdd() {
  const sheet = useUI((s) => s.sheet);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ReactNode>(null);
  useEffect(() => {
    setDone(null);
    setBusy(false);
  }, [sheet]);

  const editing = sheet && ((sheet.kind === "person" && sheet.preset?.person_id) || (sheet.kind === "post" && sheet.preset?.post_id)
    || (sheet.kind === "idea" && sheet.preset?.idea_id) || (sheet.kind === "own_project" && sheet.preset?.own_project_id) || (sheet.kind === "template" && sheet.preset?.template_id) || sheet.preset?.edit);
  const title = sheet ? `${TITLES[sheet.kind]}${editing ? " · düzenle" : ""}` : "";
  const formId = "quick-form";
  const footer = done ? null : (
    <>
      <button type="button" className="btn btn-sec btn-lg" onClick={closeSheet}>Vazgeç</button>
      <button type="submit" form={formId} className="btn btn-pri btn-lg" disabled={busy}>
        {busy ? "Kaydediliyor" : "Kaydet"}
      </button>
    </>
  );

  return (
    <Sheet open={!!sheet} title={title} onClose={closeSheet} footer={footer}>
      {done ? (
        done
      ) : sheet ? (
        <Suspense fallback={null}>
          <FormBody key={JSON.stringify(sheet)} sheet={sheet} formId={formId} setBusy={setBusy} setDone={setDone} />
        </Suspense>
      ) : null}
    </Sheet>
  );
}

export interface FormProps {
  sheet: SheetState;
  formId: string;
  setBusy: (b: boolean) => void;
  setDone: (n: ReactNode) => void;
}

function FormBody(p: FormProps) {
  switch (p.sheet.kind) {
    case "opportunity":
      return <OpportunityForm {...p} />;
    case "person":
      return <PersonForm {...p} />;
    case "company":
      return <CompanyForm {...p} />;
    case "touch":
      return <TouchForm {...p} />;
    case "task":
      return <TaskForm {...p} />;
    case "comment":
      return <CommentForm {...p} />;
    case "draft":
      return <DraftForm {...p} />;
    case "post":
      return <PostForm {...p} />;
    case "idea":
      return <IdeaForm {...p} />;
    case "template":
      return <TemplateForm {...p} />;
    case "project":
      return <ProjectForm {...p} />;
    case "goal":
      return <GoalForm {...p} />;
    case "own_project":
      return <OwnProjectForm {...p} />;
  }
}

/** Gönderimi saran ortak işleyici */
export function useSubmit(p: FormProps, fn: () => Promise<ReactNode | void>) {
  return async (e: FormEvent) => {
    e.preventDefault();
    p.setBusy(true);
    try {
      const res = await fn();
      if (res) p.setDone(res);
      else closeSheet();
    } catch {
      /* hata bildirimi run() içinde */
    } finally {
      p.setBusy(false);
    }
  };
}

/** Anything a task or comment can be about: opportunity, project, person, company (one list, typed options) */
export type LinkOption = Option & { type: "opportunity" | "project" | "person" | "company"; tid: number };
export function useLinkOptions(): LinkOption[] {
  const people = usePeople();
  const companies = useCompanies();
  const opps = useOpps();
  const projects = useProjects();
  return useMemo(() => {
    const list: LinkOption[] = [];
    let n = 0;
    for (const o of opps.rows) list.push({ id: ++n, label: o.title, sub: `Fırsat · ${o.person_name}`, type: "opportunity", tid: o.id });
    for (const x of projects.rows) list.push({ id: ++n, label: x.name, sub: "Proje", type: "project", tid: x.id });
    for (const x of people.rows) list.push({ id: ++n, label: x.name, sub: x.company_name ?? "Kişi", type: "person", tid: x.id });
    for (const x of companies.rows) list.push({ id: ++n, label: x.name, sub: "Firma", type: "company", tid: x.id });
    return list;
  }, [opps.rows, projects.rows, people.rows, companies.rows]);
}

export function usePersonOptions(): Option[] {
  const people = usePeople();
  return useMemo(() => people.rows.map((x) => ({ id: x.id, label: x.name, sub: x.company_name ?? undefined })), [people.rows]);
}

// ---------------------------------------------------------------- fırsat
function OpportunityForm(p: FormProps) {
  if (p.sheet.preset?.edit) return <OpportunityEdit {...p} id={p.sheet.preset.edit} />;
  return <OpportunityCreate {...p} />;
}

/** Fırsat düzenleme: başlık, tutar, kaynak, ilan linki ve tarihi, takip tarihi (aşama huniden) */
function OpportunityEdit(p: FormProps & { id: number }) {
  const d = useQuery<Detail<Opportunity>>(`/opportunities/${p.id}`);
  const o = d.data?.row;
  const sources = useSources();
  const personOptions = usePersonOptions();
  const [person, setPerson] = useState<Ref>(emptyRef);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState("");
  const [url, setUrl] = useState("");
  const [srcDate, setSrcDate] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    if (!o) return;
    setPerson({ id: o.person_id, text: o.person_name });
    setTitle(o.title);
    setValue(o.estimated_value || null);
    setSourceId(String(o.source_id));
    setUrl(o.source_url ?? "");
    setSrcDate(o.source_date ?? "");
    setDate(o.next_follow_up_at ?? "");
  }, [o]);
  const submit = useSubmit(p, async () => {
    await run("patch", `/opportunities/${p.id}`, {
      person_id: await ensurePerson(person, { tags: ["aday"] }), title: title.trim(), estimated_value: value, source_id: Number(sourceId),
      source_url: url, source_date: srcDate || null, next_follow_up_at: date || null,
    }, { ok: "Fırsat güncellendi" });
  });
  if (!o) return null;
  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <p className="m-0 text-base text-text-secondary">Aşama: {STAGE[o.stage]} (aşama fırsat sayfasından değişir)</p>
      <Field label="Muhatap (kişi)" htmlFor="oe-person">
        <Combo id="oe-person" value={person} onChange={setPerson} options={personOptions} placeholder="Kişi ara" />
      </Field>
      <Field label="Ne yapılacak" htmlFor="oe-title">
        <input id="oe-title" className="inp" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Kaynak">
        <ChipRadio label="Kaynak" items={pickable(sources.rows, [o.source_id]).map((s) => ({ value: String(s.id), label: s.name }))} value={sourceId} onChange={setSourceId} />
      </Field>
      <SourceLinkFields url={url} setUrl={setUrl} date={srcDate} setDate={setSrcDate} />
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Tahmini tutar (₺)" htmlFor="oe-value">
          <NumberField id="oe-value" className="inp font-mono" min={0} value={value} onChange={setValue} />
        </Field>
        <Field label="Sıradaki adım tarihi" htmlFor="oe-date">
          <input id="oe-date" className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </form>
  );
}

/** İlanın ya da konunun linki ve tarihi (R10 ilanı gibi) */
function SourceLinkFields({ url, setUrl, date, setDate }: { url: string; setUrl: (v: string) => void; date: string; setDate: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
      <Field label="Kaynak linki" htmlFor="o-url">
        <input id="o-url" className="inp" type="url" inputMode="url" placeholder="https://www.r10.net/..." value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <Field label="İlan tarihi" htmlFor="o-srcdate">
        <input id="o-srcdate" className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
    </div>
  );
}

function OpportunityCreate(p: FormProps) {
  const sources = useSources();
  const companies = useCompanies();
  const people = usePeople();
  const personOptions = usePersonOptions();
  const companyOptions = useMemo(() => companies.rows.map((c) => ({ id: c.id, label: c.name })), [companies.rows]);

  const [person, setPerson] = useState<Ref>(emptyRef);
  // Mevcut kişi seçilince firması da gelir
  const pickPerson = (v: Ref) => {
    setPerson(v);
    const x = v.id ? people.byId.get(v.id) : undefined;
    if (x?.company_id) setCompany({ id: x.company_id, text: x.company_name ?? "" });
  };
  const [company, setCompany] = useState<Ref>(emptyRef);
  const [title, setTitle] = useState("");
  const [sourceId, setSourceId] = useState<string>("");
  const [newSource, setNewSource] = useState("");
  const [referrer, setReferrer] = useState<Ref>(emptyRef);
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(addDaysIso(todayIso(), 1));
  const [stage, setStage] = useState<OppStage>(p.sheet.preset?.stage ?? "bulundu");
  const [step, setStep] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [srcDate, setSrcDate] = useState("");

  const live = pickable(sources.rows);
  const src = sourceId ? sources.byId.get(Number(sourceId)) : live[0];
  const isRef = src ? src.kind === "referans" || /referans/i.test(src.name) : false;

  const submit = useSubmit(p, async () => {
    let source_id = src?.id;
    if (!source_id) {
      const s = await run<Source>("post", "/sources", { name: newSource.trim() || "Diğer" }, { silent: true });
      source_id = s.row!.id;
    }
    const person_id = await ensurePerson(person, { company, referred_by: isRef ? referrer : undefined, tags: ["aday"], next_follow_up_at: date });
    const o = await run<Opportunity>("post", "/opportunities", {
      title: title.trim() || company.text.trim() || person.text.trim(),
      person_id, source_id, stage,
      estimated_value: value,
      next_follow_up_at: date || undefined,
      source_url: url.trim() || undefined, source_date: srcDate || undefined,
    }, { silent: true });
    const oid = o.row!.id;
    if (step.trim()) await run("post", "/tasks", { title: step.trim(), assignee: "ozgur", due_date: date || undefined, opportunity_id: oid }, { silent: true });
    if (note.trim()) await run("post", "/comments", { target_type: "opportunity", target_id: oid, body: note.trim() }, { silent: true });
    return (
      <Done
        title="Fırsat eklendi"
        text={`${person.text.trim()} “${STAGE[stage]}” aşamasına eklendi.`}
        again={() => p.setDone(null)}
        href={PATHS.pipeline}
        hrefLabel="Huniye git"
      />
    );
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Kişi" htmlFor="f-person">
          <Combo id="f-person" value={person} onChange={pickPerson} options={personOptions} placeholder="Ad soyad ara ya da yeni yaz" />
        </Field>
        <Field label="Firma" htmlFor="f-company">
          <Combo id="f-company" value={company} onChange={setCompany} options={companyOptions} placeholder="Firma adı" />
        </Field>
      </div>
      <Field label="Ne yapılacak" htmlFor="f-title">
        <input id="f-title" className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. kurumsal web sitesi" />
      </Field>
      <Field label="Kaynak">
        {live.length ? (
          <ChipRadio
            label="Kaynak"
            items={live.map((s) => ({ value: String(s.id), label: s.name }))}
            value={String(src?.id ?? "")}
            onChange={setSourceId}
          />
        ) : (
          <input className="inp" value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="Henüz kaynak yok: ör. R10" aria-label="Yeni kaynak" />
        )}
        {isRef ? (
          <Reveal>
            <Field label="Kim tanıttı" htmlFor="f-ref">
              <Combo id="f-ref" value={referrer} onChange={setReferrer} options={personOptions} placeholder="Kişi ara" allowNew={false} />
            </Field>
          </Reveal>
        ) : null}
      </Field>
      <SourceLinkFields url={url} setUrl={setUrl} date={srcDate} setDate={setSrcDate} />
      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Field label="Tahmini tutar (₺)" htmlFor="f-value">
          <NumberField id="f-value" className="inp font-mono" min={0} value={value} onChange={setValue} placeholder="25.000" />
        </Field>
        <Field label="Sıradaki adım tarihi" htmlFor="f-date">
          <input id="f-date" className="inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label="Aşama">
        <ChipRadio label="Aşama" items={OPEN_STAGES.map((s) => ({ value: s, label: STAGE[s] }))} value={stage} onChange={setStage} />
      </Field>
      <Field label="Sıradaki adım" htmlFor="f-step">
        <input id="f-step" className="inp" value={step} onChange={(e) => setStep(e.target.value)} placeholder="Örn. ilk mesajı at" />
      </Field>
      <Field label="İlk yorum" htmlFor="f-note">
        <textarea id="f-note" className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Claude’un bilmesi gereken bir şey varsa yaz" />
      </Field>
      <SubmitGuard ok={!!person.text.trim()} />
    </form>
  );
}

/** Zorunlu alan eksikse formu göndermeyi engeller (tarayıcı uyarısıyla) */
export function SubmitGuard({ ok }: { ok: boolean }) {
  return ok ? null : <input className="sr-only" tabIndex={-1} aria-hidden="true" required value="" onChange={() => {}} />;
}

// ---------------------------------------------------------------- görev
function TaskForm(p: FormProps) {
  const options = useLinkOptions();
  const pre = p.sheet.preset;
  const editId = pre?.edit;
  const existing = useQuery<Detail<Task>>(editId ? `/tasks/${editId}` : null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(pre?.date ?? todayIso());
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<TaskKind>("gorev");
  const [target, setTarget] = useState<Ref>(emptyRef);
  const row = existing.data?.row;
  /** The record the task is already tied to (edit) or was opened from (preset) */
  const linked = row
    ? { person: row.person_id, company: row.company_id, opportunity: row.opportunity_id, project: row.project_id }
    : { person: pre?.person_id, company: pre?.company_id, opportunity: pre?.opportunity_id, project: pre?.project_id };
  useEffect(() => {
    if (row) {
      setTitle(row.title);
      setDue(row.due_date ?? "");
      setTime(row.due_time ?? "");
      setKind(row.kind);
    }
    const hit = options.find((o) => linked[o.type] === o.tid);
    if (hit) setTarget({ id: hit.id, text: hit.label });
    // options arrive after the first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, options]);

  const submit = useSubmit(p, async () => {
    const t = options.find((o) => o.id === target.id);
    const link = { person_id: null, company_id: null, opportunity_id: null, project_id: null, ...(t ? { [`${t.type}_id`]: t.tid } : {}) };
    if (editId) await run<Task>("patch", `/tasks/${editId}`, { title: title.trim(), due_date: due || null, due_time: time || null, kind, ...link }, { ok: "Görev güncellendi" });
    else await run<Task>("post", "/tasks", { title: title.trim(), assignee: "ozgur", due_date: due || undefined, due_time: time || undefined, kind, ...link }, { ok: "Görev eklendi" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      <Field label="Görev" htmlFor="k-title">
        <input id="k-title" className="inp" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. muhasebeci ile görüş, toplantı" />
      </Field>
      <Field label="Tarih" htmlFor="k-due">
        <input id="k-due" className="inp" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <Field label="Saat (isteğe bağlı)" htmlFor="k-time">
        <input id="k-time" className="inp" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <Field label="Tür">
        <ChipRadio label="Tür" items={TASK_KIND_ITEMS} value={kind} onChange={setKind} />
      </Field>
      <Field label="Neyle ilgili (isteğe bağlı)" htmlFor="k-target">
        <Combo id="k-target" value={target} onChange={setTarget} options={options} placeholder="Kişi, firma, fırsat ya da proje ara" allowNew={false} />
      </Field>
    </form>
  );
}

// ---------------------------------------------------------------- yorum
function CommentForm(p: FormProps) {
  const preTarget = p.sheet.preset?.target;
  const options = useLinkOptions();
  const [target, setTarget] = useState<Ref>(emptyRef);
  const [body, setBody] = useState("");

  const submit = useSubmit(p, async () => {
    const t = preTarget ?? (() => {
      const o = options.find((x) => x.id === target.id);
      return o ? { type: o.type, id: o.tid } : null;
    })();
    if (!t) throw new Error("hedef yok");
    await run("post", "/comments", { target_type: t.type, target_id: t.id, body: body.trim() }, { ok: "Yorum eklendi, Claude MCP’den görecek" });
  });

  return (
    <form id={p.formId} onSubmit={submit} className="flex flex-col gap-8">
      {preTarget ? (
        <p className="m-0 text-base text-text-secondary">{preTarget.label}</p>
      ) : (
        <Field label="Neyle ilgili" htmlFor="c-target">
          <Combo id="c-target" value={target} onChange={setTarget} options={options} placeholder="Fırsat, proje, kişi ya da firma ara" allowNew={false} />
        </Field>
      )}
      <Field label="Yorum" htmlFor="c-body">
        <textarea id="c-body" className="inp min-h-textarea-lg" required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Not ya da soru yaz" />
      </Field>
      <div className="flex items-center gap-3">
        <span className="who bg-author-ozgur-bg text-author-ozgur-fg">Özgür</span>
        <span className="text-sm text-text-muted">olarak yazıyorsun · Claude MCP’den okuyup cevaplar</span>
      </div>
      <SubmitGuard ok={!!preTarget || !!target.id} />
    </form>
  );
}

// ---------------------------------------------------------------- ortak
function Reveal({ children }: { children: ReactNode }) {
  return (
    <m.div initial={{ opacity: 0, y: -riseY / 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.segment, ease: ease.out }} className="flex flex-col gap-3">
      {children}
    </m.div>
  );
}

function Done({ title, text, again, href, hrefLabel }: { title: string; text: string; again: () => void; href: string; hrefLabel: string }) {
  return (
    <div className="flex flex-grow flex-col items-center justify-center gap-6 px-10 py-12 text-center">
      <m.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: dur.rise, ease: ease.pop }}
        className="flex size-tick items-center justify-center rounded-pill bg-accent-soft-bg text-accent-text"
      >
        <Icon name="check" className="size-icon-2xl" stroke={2.4} />
      </m.div>
      <h2 className="m-0 text-xl font-semibold">{title}</h2>
      <p className="m-0 max-w-content-narrow text-base leading-normal text-text-secondary">{text}</p>
      <div className="flex gap-3">
        <Link href={href} onClick={closeSheet} className="btn btn-pri btn-lg">{hrefLabel}</Link>
        <button type="button" className="btn btn-sec btn-lg" onClick={again}>Bir tane daha</button>
      </div>
    </div>
  );
}
