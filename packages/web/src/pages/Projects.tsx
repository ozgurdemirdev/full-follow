import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useProjects, useThreads } from "../api/keys";
import type { Project } from "../api/types";
import { Page } from "../app/Page";
import { timelinePath } from "../app/routes";
import { Chip, Empty, ErrorBox, order, PageSkeleton, Segmented, Who } from "../components/ui";
import { fmtDay, tl } from "../lib/format";
import { useIsDesktop } from "../lib/media";
import { MILESTONE, PROJECT_STAGE, PROJECT_STEPS } from "../lib/labels";

const TABS = [
  { label: "Aktif", test: (p: Project) => ["pesinat", "tasarim_onayi", "test_surumu", "yayin"].includes(p.stage) },
  { label: "Bakımda", test: (p: Project) => p.stage === "bakim" },
  { label: "Teslim edildi", test: (p: Project) => p.stage === "teslim" },
  { label: "İptal", test: (p: Project) => p.stage === "iptal" },
];

export default function Projects() {
  const projects = useProjects();
  const threads = useThreads();
  const desk = useIsDesktop();
  const [tab, setTab] = useState(0);

  const counts = TABS.map((t) => projects.rows.filter(t.test).length);
  const shown = projects.rows.filter(TABS[tab].test);
  const unanswered = useMemo(
    () => new Set(threads.rows.filter((t) => t.target_type === "project" && t.last_by === "ozgur").map((t) => t.target_id)),
    [threads.rows],
  );
  const month = new Date().toISOString().slice(0, 7);
  const expectedThisMonth = projects.rows.reduce((a, p) => (p.next_payment?.due_date?.startsWith(month) ? a + p.next_payment.remaining : a), 0);
  const tabs = TABS.map((t, i) => `${t.label} (${counts[i]})`).filter((_, i) => i < 3 || counts[3] > 0);

  return (
    <Page title="Proje panosu" sub={projects.data ? `${counts[0]} aktif proje · bu ay beklenen ${tl(expectedThisMonth)}` : ""}>
      {projects.error && !projects.data ? <ErrorBox error={projects.error} retry={projects.reload} /> : null}
      {!projects.data ? (
        !projects.error && <PageSkeleton />
      ) : (
        <>
          <Segmented label="Proje durumu" items={tabs} value={tab} onChange={setTab} width={desk ? "var(--spacing-seg-tab)" : "var(--spacing-seg-tab-mobile)"} />
          {shown.length === 0 ? <div className="card"><Empty>Bu durumda proje yok. Kazanılan fırsatlar otomatik proje olur.</Empty></div> : null}
          <div className="grid grid-cols-1 gap-7 desk:grid-cols-2">
            {shown.map((p, i) => (
              <ProjectCard key={p.id} p={p} i={i} unanswered={unanswered.has(p.id)} />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

function ProjectCard({ p, i, unanswered }: { p: Project; i: number; unanswered: boolean }) {
  const idx = PROJECT_STEPS.indexOf(p.stage);
  const total = p.expected_total || p.price;
  const paidPct = total ? Math.min(100, Math.round((p.paid_total / total) * 100)) : 0;
  return (
    <Link href={timelinePath("project", p.id)} className="card rise lift flex flex-col gap-7 p-9 text-text-primary hover:text-text-primary" style={order(i)}>
      <div className="flex items-start gap-5">
        <div className="flex min-w-0 flex-grow flex-col gap-0.5">
          <h2 className="m-0 text-lg font-semibold">{p.name}</h2>
          <span className="text-base-sm text-text-secondary">{p.person_name}</span>
        </div>
        {unanswered ? <Chip tone="warning">Cevapsız yorum</Chip> : null}
        <Who actor={p.created_by} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-3">
          <span className="text-base-sm text-text-secondary">Aşama</span>
          <span className="text-base font-medium text-primary-text-soft">{PROJECT_STAGE[p.stage]}</span>
          {idx >= 0 ? <span className="text-sm text-text-muted">{idx + 1} / {PROJECT_STEPS.length}</span> : null}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {PROJECT_STEPS.map((s, k) => (
            <div key={s} title={PROJECT_STAGE[s]} className={`h-bar-thin rounded-pill ${k < idx ? "bg-primary" : k === idx ? "step-now" : "bg-surface-track"}`} />
          ))}
        </div>
        <div className="hidden grid-cols-6 gap-1 text-xs text-text-muted desk:grid">
          {PROJECT_STEPS.map((s, k) => (
            <span key={s} className={k === idx ? "font-medium text-primary-text-soft" : ""}>{PROJECT_STAGE[s]}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="inset flex min-w-0 flex-col gap-2 p-5">
          <span className="text-sm text-text-secondary">Sıradaki görev</span>
          <span className="text-base-sm leading-tight">{p.next_task?.title ?? "Görev yok"}</span>
          {p.next_task ? <Who actor={p.next_task.created_by} className="self-start" /> : null}
        </div>
        <div className="inset flex min-w-0 flex-col gap-2 p-5">
          <span className="text-sm text-text-secondary">Sıradaki ödeme</span>
          <span className="text-base-sm leading-tight">
            {p.next_payment ? `${MILESTONE[p.next_payment.milestone]}${p.next_payment.due_date ? ` · ${fmtDay(p.next_payment.due_date)}` : ""}` : "Ödeme tamam"}
          </span>
          {p.next_payment ? <span className="font-mono text-base-sm text-status-text-attention">{tl(p.next_payment.remaining)}</span> : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-sm text-text-secondary">
          <span>Ödenen</span>
          <span className="font-mono">{tl(p.paid_total)} / {tl(total)}</span>
        </div>
        <div className="track">
          <i className="grow-x bg-accent-payment" style={{ width: `${paidPct}%` }} />
        </div>
      </div>
    </Link>
  );
}
