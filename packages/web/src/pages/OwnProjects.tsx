// Kendi projelerim: Özgür'ün kendi ürünleri, satılabilir mi, hangi sektöre uyar, sıradaki fikirler
import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { remove as trash, run } from "../api/actions";
import { useOwnProjects } from "../api/keys";
import { useQuery } from "../api/store";
import type { Detail, Idea, OwnProject, Thread } from "../api/types";
import { Page } from "../app/Page";
import { PATHS } from "../app/routes";
import { openSheet } from "../app/ui";
import { Comments } from "../components/contact";
import { LinksCard } from "../components/LinksCard";
import { ProjectIdeas } from "../components/ProjectIdeas";
import { Chip, Empty, ErrorBox, Filters, PageSkeleton, Who } from "../components/ui";
import { OWN_STATUS, OWN_STATUS_TONE, OWN_STATUSES, SELLABLE, SELLABLE_TONE } from "../lib/labels";
import { useIsDesktop } from "../lib/media";

export default function OwnProjects() {
  const projects = useOwnProjects();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const desk = useIsDesktop();
  const [status, setStatus] = useState("");
  const shown = projects.rows.filter((p) => !status || p.status === status);
  const selId = Number(params.id) || (desk ? shown[0]?.id : undefined);
  const active = projects.rows.filter((p) => p.status === "aktif").length;
  const openIdeas = projects.rows.reduce((a, p) => a + p.open_ideas, 0);
  const showList = desk || !params.id;
  const showCard = !!selId && (desk || !!params.id);

  return (
    <Page
      title="Kendi projelerim"
      sub={projects.data ? `${active} aktif · ${openIdeas} açık fikir` : ""}
      right={<button type="button" className="btn btn-pri" onClick={() => openSheet("own_project")}>Proje ekle</button>}
      className="grid grid-cols-1 items-start gap-7 desk:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] desk:gap-9"
    >
      {projects.error && !projects.data ? <ErrorBox error={projects.error} retry={projects.reload} /> : null}
      {!projects.data ? (
        !projects.error && <PageSkeleton />
      ) : (
        <>
          {showList ? (
            <section className="flex min-w-0 flex-col gap-6">
              <div className="rise">
                <Filters label="Durum" value={status} onChange={setStatus} items={[{ value: "", label: "Hepsi" }, ...OWN_STATUSES.map((s) => ({ value: s, label: OWN_STATUS[s] }))]} />
              </div>
              <div className="card rise overflow-hidden">
                {shown.length === 0 ? <Empty>Henüz kendi projen yok. Kendi ürününü ekle; satılabilir mi, hangi sektöre uyar, sıradaki fikirler neler, burada dursun.</Empty> : null}
                {shown.map((p) => (
                  <button key={p.id} type="button" data-record={`own_project-${p.id}`} onClick={() => navigate(`${PATHS.ownProjects}/${p.id}`)} aria-current={p.id === selId || undefined}
                    className={`row cv-auto flex w-full flex-col gap-2 border-x-0 border-t-0 py-5 pl-7 pr-7 text-left text-text-primary ${p.id === selId && desk ? "bg-surface-2" : "bg-transparent"}`}>
                    <span className="flex items-center gap-3">
                      <span className="min-w-0 flex-grow truncate text-base font-medium">{p.name}</span>
                      <Chip tone={OWN_STATUS_TONE[p.status]}>{OWN_STATUS[p.status]}</Chip>
                      <Chip tone={SELLABLE_TONE[p.sellable]}>{SELLABLE[p.sellable]}</Chip>
                      <Who actor={p.created_by} />
                    </span>
                    <span className="truncate text-base-sm text-text-secondary">
                      {p.open_ideas} açık fikir · {p.done_ideas} yapıldı{p.sectors.length ? ` · ${p.sectors.map((s) => s.path).join(", ")}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {showCard ? (
            <div className="flex min-w-0 flex-col gap-7">
              {!desk ? <Link href={PATHS.ownProjects} className="text-base-sm">← Kendi projelerim</Link> : null}
              <OwnProjectCard key={selId} id={selId!} />
            </div>
          ) : null}
        </>
      )}
    </Page>
  );
}

type Related = { ideas: Idea[]; comments: Thread[] };

function OwnProjectCard({ id }: { id: number }) {
  const key = `/own-projects/${id}?with=ideas,comments`;
  const d = useQuery<Detail<OwnProject, Related>>(key);
  const [, navigate] = useLocation();
  const p = d.data?.row;
  if (!p) {
    return (
      <aside className="card detail p-9" aria-busy={!d.error}>
        {d.error ? <ErrorBox error={d.error} retry={d.reload} /> : <div className="h-chart-height" />}
      </aside>
    );
  }
  const setStatus = (status: string) => status !== p.status && run("patch", `/own-projects/${id}`, { status }, { ok: `Durum: ${OWN_STATUS[status]}` }).catch(() => {});
  const remove = () => {
    void trash(`/own-projects/${id}`, `“${p.name}” projesi`).then(() => navigate(PATHS.ownProjects, { replace: true })).catch(() => {});
  };

  return (
    <>
      <aside className="card slide-in flex flex-col gap-8 p-9" aria-label="Kendi projesi">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="m-0 text-lg font-semibold">{p.name}</h2>
            <Chip tone={OWN_STATUS_TONE[p.status]}>{OWN_STATUS[p.status]}</Chip>
            <Who actor={p.created_by} />
            <span className="flex-grow" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("own_project", { own_project_id: id })}>Düzenle</button>
            <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={remove}>Sil</button>
          </div>
          {p.description ? <p className="m-0 whitespace-pre-line text-base leading-normal text-text-primary">{p.description}</p> : <span className="text-base-sm text-text-muted">Ne yaptığı yazılmadı</span>}
        </div>

        <div className="inset flex flex-col gap-3 px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone={SELLABLE_TONE[p.sellable]}>{SELLABLE[p.sellable]}</Chip>
            {p.sellable_note ? <span className="text-base-sm text-text-primary">{p.sellable_note}</span> : null}
          </div>
          {p.sectors.length ? <div className="flex flex-wrap gap-2">{p.sectors.map((s) => <Chip key={s.id} tone="source">{s.path}</Chip>)}</div> : <span className="text-base-sm text-text-muted">Uygun sektör seçilmedi</span>}
        </div>

        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Durum">
          {OWN_STATUSES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={p.status === s} className="fchip h-control-height-xs" onClick={() => setStatus(s)}>{OWN_STATUS[s]}</button>
          ))}
        </div>

        <ProjectIdeas projectId={id} ideas={d.data!.related.ideas ?? []} detailKey={key} />

        {p.notes ? <p className="inset m-0 whitespace-pre-line px-6 py-5 text-base-sm leading-normal text-text-primary">{p.notes}</p> : null}
      </aside>
      <LinksCard type="own_project" id={id} />
      <Comments target={{ type: "own_project", id, label: p.name }} threads={d.data!.related.comments ?? []} />
    </>
  );
}
