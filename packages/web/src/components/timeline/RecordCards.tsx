// Side cards of the focus view for a person, an opportunity or a project: the same cards the old timeline page had
// (contact summary and actions, stage moves, payments with the amount field, links, next step), restyled by the shared card classes.
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { remove, run } from "../../api/actions";
import { qs } from "../../api/client";
import { useQuery } from "../../api/store";
import type { Detail, List, Opportunity, Payment, Person, Project, Task, Touch } from "../../api/types";
import { opportunityPath, PATHS, timelinePath } from "../../app/routes";
import { openSheet } from "../../app/ui";
import { fmtDay, tl, todayIso } from "../../lib/format";
import {
  MILESTONE, OPEN_STAGES, PROJECT_STAGE, PROJECT_STEPS, STAGE, STAGE_TONE,
  type OppStage, type ProjectStage, type Tone,
} from "../../lib/labels";
import type { AsideKind } from "../../lib/timeline";
import { EditDelete } from "../contact";
import { LinksCard } from "../LinksCard";
import { NextStep } from "../NextStep";
import { NumberField } from "../NumberField";
import { Avatar, Chip, Tags, Who } from "../ui";

const PATH: Record<AsideKind, string> = { person: "people", opportunity: "opportunities", project: "projects" };
const WITH: Record<AsideKind, string> = { person: "opportunities,projects,referrals", opportunity: "", project: "payments" };
/** Detail request of the focused record (the page reads its name from it too) */
export const detailKey = (type: AsideKind, id: number) => `/${PATH[type]}/${id}${WITH[type] ? `?with=${WITH[type]}` : ""}`;

export type AnyRow = Omit<Person, "stage"> & Omit<Opportunity, "stage"> & Omit<Project, "stage"> & { stage: string };

/** The cards of the focused record, below the board's feed on phones and beside it on desktop */
export function RecordAside({ type, id, detail, touches }: { type: AsideKind; id: number; detail: Detail<any>; touches: Touch[] }) {
  const row = detail.row as AnyRow;
  const personId = type === "person" ? id : row.person_id;
  const tasks = useQuery<List<Task>>(`/tasks${qs({ [`${type}_id`]: id, limit: 50 })}`);
  return (
    <aside className="tlx-aside">
      {type === "person" ? <PersonCard p={row} touches={touches.filter((t) => t.person_id === id)} detail={detail} /> : null}
      {type === "opportunity" ? <OppCard o={row as unknown as Opportunity} /> : null}
      {type === "project" ? <ProjectCard p={row as unknown as Project} payments={(detail.related.payments as Payment[]) ?? []} /> : null}
      {type !== "person" ? <LinksCard type={type} id={id} /> : null}
      <NextStep tasks={tasks.data?.rows ?? []} type={type} id={id} personId={personId} />
    </aside>
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
            <div key={s.l} className="rounded-inner bg-surface-inset px-1 py-4">
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
            <span className="dot bg-entity-source" />{by.name} tanıttı
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
      {o.lost_reason ? <p className="m-0 text-base-sm text-danger">Neden: {o.lost_reason}</p> : null}
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
          <span className="text-base font-medium text-accent-text-soft">{PROJECT_STAGE[p.stage]}</span>
          <span className="flex-grow" />
          <span className="font-mono text-base-sm">{tl(p.price)}</span>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {PROJECT_STEPS.map((s, k) => (
            <button key={s} type="button" title={PROJECT_STAGE[s]} aria-label={PROJECT_STAGE[s]} disabled={busy || k === idx} onClick={() => move(s)}
              className={`h-bar rounded-pill border-0 p-0 ${k < idx ? "bg-accent" : k === idx ? "step-now" : "bg-surface-track"}`} />
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
  const [amount, setAmount] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const remaining = p.expected_amount - p.paid_amount;
  const pay = async () => {
    await run("post", `/payments/${p.id}/pay`, { amount: amount ?? remaining }, { ok: "Ödeme kaydedildi" });
    setOpen(false);
    setAmount(null);
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
          <NumberField className="inp inp-num h-control-height-md" min={1} max={remaining} placeholder={remaining.toLocaleString("tr-TR")} value={amount} onChange={setAmount} onKeyDown={(e) => e.key === "Enter" && pay()} ariaLabel="Tutar" autoFocus />
          <button type="button" className="btn btn-pri" onClick={pay}>Kaydet</button>
        </div>
      ) : null}
    </div>
  );
}
