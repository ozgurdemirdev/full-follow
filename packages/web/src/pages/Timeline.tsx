import { useDeferredValue, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { remove, run } from "../api/actions";
import { qs } from "../api/client";
import { useOpps, usePeople, useProjects } from "../api/keys";
import { useQuery } from "../api/store";
import type { Detail, List, Opportunity, Payment, Person, Project, Task, Touch } from "../api/types";
import { Page } from "../app/Page";
import { opportunityPath, PATHS, timelinePath } from "../app/routes";
import { openSheet } from "../app/ui";
import { EditDelete } from "../components/contact";
import { FeedComposer, FeedItems, useFeed, type FeedGroup, type FeedKind } from "../components/Feed";
import { LinksCard } from "../components/LinksCard";
import { NextStep } from "../components/NextStep";
import { Avatar, Chip, Empty, ErrorBox, Filters, PageSkeleton, Tags, Who } from "../components/ui";
import { daysFrom, fmtDay, fmtDayLong, norm, tl, todayIso } from "../lib/format";
import {
  MILESTONE, OPEN_STAGES, PROJECT_STAGE, PROJECT_STEPS, STAGE, STAGE_TONE,
  type OppStage, type ProjectStage, type Tone,
} from "../lib/labels";

type Kind = FeedKind;
/** Filter chips of the timeline page, in display order */
const TIMELINE_GROUPS: FeedGroup[] = ["Temaslar", "Yorumlar", "Aşama", "Görevler", "Ödemeler"];

export default function Timeline() {
  const params = useParams<{ type?: string; id?: string }>();
  const type = params.type as Kind | undefined;
  const id = Number(params.id);
  if (!type || !["person", "opportunity", "project"].includes(type) || !id) return <Chooser />;
  return <EntityTimeline key={`${type}${id}`} type={type} id={id} />;
}

// ------------------------------------------------------------ seçici
function Chooser() {
  const people = usePeople();
  const opps = useOpps();
  const projects = useProjects();
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);
  const items = useMemo(() => {
    const n = norm(dq.trim());
    const all = [
      ...projects.rows.map((p) => ({ key: `r${p.id}`, type: "Proje", tone: "success" as Tone, label: p.name, sub: `${PROJECT_STAGE[p.stage]} · ${p.person_name}`, href: timelinePath("project", p.id) })),
      ...opps.rows.map((o) => ({ key: `o${o.id}`, type: "Fırsat", tone: "opportunity" as Tone, label: o.title, sub: `${STAGE[o.stage]} · ${o.person_name}`, href: timelinePath("opportunity", o.id) })),
      ...people.rows.map((p) => ({
        key: `p${p.id}`, type: "Kişi", tone: "neutral" as Tone, label: p.name,
        sub: [p.company_name, p.sector_path].filter(Boolean).join(" · ") || "Firma ve sektör yok", href: timelinePath("person", p.id),
      })),
    ];
    return (n ? all.filter((x) => norm(x.label).includes(n) || norm(x.sub).includes(n)) : all).slice(0, 40);
  }, [dq, people.rows, opps.rows, projects.rows]);

  return (
    <Page title="Zaman çizelgesi" sub="Kimin geçmişine bakmak istiyorsun?" width="narrow">
      <input className="inp rise" type="search" placeholder="Kişi, fırsat ya da proje ara" aria-label="Ara" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="card rise overflow-hidden">
        {!people.data ? <Empty>Yükleniyor</Empty> : items.length === 0 ? <Empty>Sonuç yok</Empty> : null}
        {items.map((x) => (
          <Link key={x.key} href={x.href} className="row cv-auto flex items-center gap-5 px-9 py-5 text-text-primary hover:text-text-primary">
            <span className="flex min-w-0 flex-grow flex-col gap-0.5">
              <span className="truncate text-base font-medium">{x.label}</span>
              <span className="truncate text-base-sm text-text-secondary">{x.sub}</span>
            </span>
            <Chip tone={x.tone}>{x.type}</Chip>
          </Link>
        ))}
      </div>
    </Page>
  );
}

// ------------------------------------------------------------ çizelge
const PATH: Record<Kind, string> = { person: "people", opportunity: "opportunities", project: "projects" };
const WITH: Record<Kind, string> = { person: "opportunities,projects,referrals", opportunity: "", project: "payments" };

type AnyRow = Omit<Person, "stage"> & Omit<Opportunity, "stage"> & Omit<Project, "stage"> & { stage: string };

function EntityTimeline({ type, id }: { type: Kind; id: number }) {
  const detail = useQuery<Detail<any>>(`/${PATH[type]}/${id}${WITH[type] ? `?with=${WITH[type]}` : ""}`);
  const row = detail.data?.row as AnyRow | undefined;
  const personId = type === "person" ? id : row?.person_id;
  const { events, touches, items, commentById, openThread } = useFeed(type, id);
  const tasks = useQuery<List<Task>>(`/tasks${qs({ [`${type}_id`]: id, limit: 50 })}`);
  const [filter, setFilter] = useState<FeedGroup | "Hepsi">("Hepsi");

  const shown = filter === "Hepsi" ? items : items.filter((x) => x.k.group === filter);
  const groups = TIMELINE_GROUPS.filter((g) => items.some((x) => x.k.group === g));

  if (detail.error && !detail.data) return <Page title="Zaman çizelgesi"><ErrorBox error={detail.error} retry={detail.reload} /></Page>;
  if (!row) return <Page title="Zaman çizelgesi"><PageSkeleton /></Page>;

  const first = events.data?.[0]?.created_at;
  const title = type === "person" ? row.name : type === "project" ? row.name : row.title;
  const sub = [
    type === "person" ? row.company_name : row.person_name,
    first ? `ilk kayıt ${fmtDayLong(first)}` : null,
    first ? `${Math.max(0, -daysFrom(first))} gündür takipte` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Page
      title={title}
      sub={sub}
      right={groups.length ? <Filters label="Olay türü" value={filter} onChange={setFilter} items={[{ value: "Hepsi" as const, label: "Hepsi" }, ...groups.map((g) => ({ value: g, label: g }))]} /> : null}
      className="grid grid-cols-1 items-start gap-7 desk:grid-cols-[minmax(0,1fr)_var(--spacing-aside-panel)] desk:gap-10"
    >
      <section aria-label="Olaylar" className="order-2 flex min-w-0 flex-col desk:order-1">
        <FeedItems items={shown} commentById={commentById} loaded={!!events.data} />
        <FeedComposer type={type} id={id} label={title} openThread={openThread} />
      </section>

      <aside className="order-1 flex flex-col gap-7 desk:order-2">
        {type === "person" ? <PersonCard p={row} touches={touches} detail={detail.data!} /> : null}
        {type === "opportunity" ? <OppCard o={row as unknown as Opportunity} /> : null}
        {type === "project" ? <ProjectCard p={row as unknown as Project} payments={(detail.data?.related.payments as Payment[]) ?? []} /> : null}
        {type !== "person" ? <LinksCard type={type} id={id} /> : null}
        <NextStep tasks={tasks.data?.rows ?? []} type={type} id={id} personId={personId} />
      </aside>
    </Page>
  );
}

// ------------------------------------------------------------ yan panel
function PersonCard({ p, touches, detail }: { p: Person; touches: Touch[]; detail: Detail<Person> }) {
  const opps = (detail.related.opportunities as Opportunity[] | undefined) ?? [];
  const referrals = (detail.related.referrals as Person[] | undefined) ?? [];
  const stats = [
    { n: touches.length, l: "temas" },
    { n: touches.filter((t) => t.direction === "gelen").length, l: "cevap" },
    { n: touches.filter((t) => t.kind === "gorusme").length, l: "görüşme" },
  ];
  const ask = () =>
    run("post", "/tasks", { title: `${p.name} için mesaj taslağı hazırla`, assignee: "claude", due_date: todayIso(), person_id: p.id }, { ok: "Claude’a görev verildi, taslak onayına düşecek" });
  return (
    <>
      <section className="card rise flex flex-col gap-6 p-8">
        <div className="flex items-center gap-5">
          <Avatar name={p.name} size="lg" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-md font-semibold">{p.name}</span>
            <span className="text-base-sm text-text-secondary">{[p.company_name, p.email ?? p.phone ?? p.handle].filter(Boolean).join(" · ")}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tags ids={p.tag_ids} />
          {[...new Set(opps.map((o) => o.source_name))].map((s) => <Chip key={s} tone="source">{s}</Chip>)}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {stats.map((s) => (
            <div key={s.l} className="rounded-xl bg-surface-inset px-1 py-4">
              <div className="text-xl font-semibold">{s.n}</div>
              <div className="text-xs text-text-secondary">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-pri" onClick={() => openSheet("touch", { person_id: p.id })}>Temas ekle</button>
          <button type="button" className="btn btn-sec" onClick={ask}>Claude’dan taslak iste</button>
          <button type="button" className="btn btn-sec" onClick={() => openSheet("person", { person_id: p.id })}>Düzenle</button>
        </div>
      </section>
      {opps.length ? (
        <section className="card rise flex flex-col gap-3 p-8">
          <h2 className="m-0 text-base font-semibold">Fırsatlar</h2>
          {opps.map((o) => (
            <Link key={o.id} href={opportunityPath(o.id)} className="inset flex items-center gap-3 px-5 py-4 text-text-primary hover:text-text-primary">
              <span className="min-w-0 flex-grow truncate text-base">{o.title}</span>
              <Who actor={o.created_by} />
              <Chip tone={STAGE_TONE[o.stage]}>{STAGE[o.stage]}</Chip>
            </Link>
          ))}
        </section>
      ) : null}
      <Referrals by={p.referred_by_id ? { id: p.referred_by_id, name: p.referred_by_name ?? "" } : null} name={p.name} referrals={referrals} />
    </>
  );
}

function Referrals({ by, name, referrals }: { by: { id: number; name: string } | null; name: string; referrals: Person[] }) {
  if (!by && !referrals.length) return null;
  return (
    <section className="card rise flex flex-col gap-5 p-8">
      <h2 className="m-0 text-base font-semibold">Referans ağı</h2>
      <div className="flex flex-col">
        {by ? (
          <Link href={timelinePath("person", by.id)} className="flex items-center gap-4 text-base-sm">
            <span className="dot bg-accent-source" />{by.name} tanıttı
          </Link>
        ) : null}
        <div className="ml-1 flex flex-col gap-3 border-l-2 border-border-subtle py-3 pl-6">
          <span className="text-base font-medium">{name}</span>
          {referrals.map((r) => (
            <Link key={r.id} href={timelinePath("person", r.id)} className="text-base-sm text-text-neutral-chip">
              <span className="text-text-muted">tanıttı · </span>{r.name}{r.company_name ? ` · ${r.company_name}` : ""}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function OppCard({ o }: { o: Opportunity }) {
  const [busy, setBusy] = useState(false);
  const [, navigate] = useLocation();
  const del = () => remove(`/opportunities/${o.id}`, o.title).then(() => navigate(PATHS.pipeline)).catch(() => {});
  const move = async (stage: OppStage) => {
    let reason: string | undefined;
    if (stage === "kaybedildi") {
      reason = window.prompt("Neden kaybedildi?")?.trim();
      if (!reason) return;
    }
    setBusy(true);
    try {
      await run("post", `/opportunities/${o.id}/move`, { stage, reason }, { ok: `Aşama: ${STAGE[stage]}` });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card rise flex flex-col gap-6 p-8">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-grow flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-3 text-md font-semibold">{o.title}<Who actor={o.created_by} /></span>
          <span className="text-base-sm text-text-secondary">Muhatap: <Link href={timelinePath("person", o.person_id)}>{o.person_name}{o.company_name ? ` · ${o.company_name}` : ""}</Link></span>
        </div>
        <EditDelete label={o.title} onEdit={() => openSheet("opportunity", { edit: o.id })} onDelete={o.project_id ? undefined : del} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip tone="source">{o.source_name}</Chip>
        <Chip tone={STAGE_TONE[o.stage]}>{STAGE[o.stage]}{o.estimated_value ? ` · ${tl(o.estimated_value)}` : ""}</Chip>
      </div>
      {o.source_url || o.source_date ? (
        <p className="m-0 flex min-w-0 flex-wrap gap-2 text-base-sm">
          <span className="text-text-muted">İlan{o.source_date ? ` · ${fmtDay(o.source_date)}` : ""}</span>
          {o.source_url ? <a href={o.source_url} target="_blank" rel="noreferrer" className="min-w-0 truncate">{o.source_url}</a> : null}
        </p>
      ) : null}
      {o.lost_reason ? <p className="m-0 text-base-sm text-status-text-danger">Neden: {o.lost_reason}</p> : null}
      <div className="flex flex-col gap-3">
        <span className="lab">Aşamayı değiştir</span>
        <div className="flex flex-wrap gap-2">
          {[...OPEN_STAGES, "kazanildi" as const, "kaybedildi" as const].map((s) => (
            <button key={s} type="button" className="fchip h-control-height-sm" aria-pressed={o.stage === s} disabled={busy || o.stage === s} onClick={() => move(s)}>
              {STAGE[s]}
            </button>
          ))}
        </div>
      </div>
      {o.project_id ? <Link href={timelinePath("project", o.project_id)} className="btn btn-sec">Projeye git</Link> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-pri" onClick={() => openSheet("touch", { person_id: o.person_id, opportunity_id: o.id })}>Temas ekle</button>
        <button type="button" className="btn btn-sec" onClick={() => openSheet("comment", { target: { type: "opportunity", id: o.id, label: o.title } })}>Yorum</button>
      </div>
    </section>
  );
}

function ProjectCard({ p, payments }: { p: Project; payments: Payment[] }) {
  const idx = PROJECT_STEPS.indexOf(p.stage);
  const [busy, setBusy] = useState(false);
  const move = async (stage: ProjectStage) => {
    setBusy(true);
    try {
      await run("post", `/projects/${p.id}/move`, { stage }, { ok: `Aşama: ${PROJECT_STAGE[stage]}` });
    } finally {
      setBusy(false);
    }
  };
  const next = idx >= 0 && idx < PROJECT_STEPS.length - 1 ? PROJECT_STEPS[idx + 1] : null;
  return (
    <>
      <section className="card rise flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-0.5">
          <span className="text-md font-semibold">{p.name}</span>
          <Link href={timelinePath("person", p.person_id)} className="text-base-sm">{p.person_name}</Link>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-base-sm text-text-secondary">Aşama</span>
          <span className="text-base font-medium text-primary-text-soft">{PROJECT_STAGE[p.stage]}</span>
          <span className="flex-grow" />
          <span className="font-mono text-base-sm">{tl(p.price)}</span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {PROJECT_STEPS.map((s, k) => (
            <button key={s} type="button" title={PROJECT_STAGE[s]} aria-label={PROJECT_STAGE[s]} disabled={busy || k === idx} onClick={() => move(s)}
              className={`h-bar rounded-pill border-0 p-0 ${k < idx ? "bg-primary" : k === idx ? "step-now" : "bg-surface-track"}`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {next ? <button type="button" className="btn btn-pri" disabled={busy} onClick={() => move(next)}>{PROJECT_STAGE[next]} aşamasına geç</button> : null}
          {p.stage !== "iptal" ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => confirm("Proje iptal edilsin mi?") && move("iptal")}>İptal et</button> : null}
        </div>
      </section>
      <section className="card rise flex flex-col gap-3 p-8">
        <h2 className="m-0 text-base font-semibold">Ödemeler</h2>
        {payments.length === 0 ? <p className="m-0 text-base-sm text-text-secondary">Ödeme planı yok. Fiyat girilince plan oluşur.</p> : null}
        {payments.map((x) => <PaymentRow key={x.id} p={x} />)}
      </section>
    </>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);
  const remaining = p.expected_amount - p.paid_amount;
  const pay = async () => {
    await run("post", `/payments/${p.id}/pay`, { amount: Number(amount || remaining) }, { ok: "Ödeme kaydedildi" });
    setOpen(false);
    setAmount("");
  };
  const tone: Tone = p.status === "odendi" ? "success" : p.status === "gecikmis" ? "warning" : "payment";
  const st = { odendi: "Ödendi", kismi: "Kısmi", bekliyor: "Bekliyor", gecikmis: "Gecikti" }[p.status];
  return (
    <div className="inset flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-grow text-base">{MILESTONE[p.milestone]}</span>
        <Who actor={p.created_by} />
        <Chip tone={tone}>{st}</Chip>
      </div>
      <div className="flex items-center gap-3 text-sm text-text-secondary">
        <span className="font-mono">{tl(p.paid_amount)} / {tl(p.expected_amount)}</span>
        <span className="flex-grow" />
        {p.due_date ? <span>{fmtDay(p.due_date)}</span> : null}
        {remaining > 0 && !open ? <button type="button" className="btn btn-sec btn-sm" onClick={() => setOpen(true)}>Ödeme gir</button> : null}
      </div>
      {open ? (
        <div className="flex gap-3">
          <input className="inp inp-num h-control-height-md" type="number" inputMode="numeric" min={1} max={remaining} placeholder={String(remaining)} value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && pay()} aria-label="Tutar" autoFocus />
          <button type="button" className="btn btn-pri" onClick={pay}>Kaydet</button>
        </div>
      ) : null}
    </div>
  );
}
