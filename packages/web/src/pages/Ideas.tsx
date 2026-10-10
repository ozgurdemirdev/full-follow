import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { remove as trash, run } from "../api/actions";
import { useIdeas } from "../api/keys";
import { useQuery } from "../api/store";
import type { Detail, Idea, Interest, Post, Touch } from "../api/types";
import { Page } from "../app/Page";
import { PATHS } from "../app/routes";
import { openSheet } from "../app/ui";
import { Combo } from "../components/Combo";
import { Chip, Empty, ErrorBox, Filters, order, PageSkeleton, Who } from "../components/ui";
import { usePersonOptions } from "../forms/QuickAdd";
import { emptyRef, type Ref } from "../forms/helpers";
import { ago, pct } from "../lib/format";
import { IDEA_STAGE, IDEA_STAGES, IDEA_TONE, INTEREST, INTEREST_TONE, PLATFORM } from "../lib/labels";
import { channelName } from "../lib/network";

// Ürün fikirleri: hangi sorunu çözüyor, hangi sektöre; kaç kişiye anlatıldı, kaçı ilgilendi
export default function Ideas() {
  const ideas = useIdeas();
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const [stage, setStage] = useState("");
  const shown = ideas.rows.filter((i) => !stage || i.stage === stage);
  const selId = Number(params.id) || shown[0]?.id;
  const told = ideas.rows.reduce((a, i) => a + i.told, 0);
  const interested = ideas.rows.reduce((a, i) => a + i.interested, 0);

  return (
    <Page
      title="Fikirler"
      sub={ideas.data ? `${ideas.rows.length} fikir · ${told} kişiye anlatıldı, ${interested} ilgilendi` : ""}
      right={<button type="button" className="btn btn-pri" onClick={() => openSheet("idea")}>Fikir ekle</button>}
      className="grid grid-cols-1 items-start gap-7 desk:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] desk:gap-9"
    >
      {ideas.error && !ideas.data ? <ErrorBox error={ideas.error} retry={ideas.reload} /> : null}
      {!ideas.data ? (
        !ideas.error && <PageSkeleton />
      ) : (
        <>
          <section className="flex min-w-0 flex-col gap-6">
            <div className="rise">
              <Filters label="Aşama" value={stage} onChange={setStage} items={[{ value: "", label: "Hepsi" }, ...IDEA_STAGES.map((s) => ({ value: s, label: IDEA_STAGE[s] }))]} />
            </div>
            <div className="card rise overflow-hidden">
              {shown.length === 0 ? <Empty>Henüz fikir yok. Ürün fikrini, çözdüğü sorunu ve hedef sektörü yaz; kime anlattığını buradan ölç.</Empty> : null}
              {shown.map((i) => (
                <button key={i.id} type="button" onClick={() => navigate(`${PATHS.ideas}/${i.id}`, { replace: true })} aria-current={i.id === selId || undefined}
                  className={`row cv-auto flex w-full flex-col gap-2 border-x-0 border-t-0 px-7 py-5 text-left text-text-primary ${i.id === selId ? "bg-surface-2" : "bg-transparent"}`}>
                  <span className="flex items-center gap-3">
                    <span className="min-w-0 flex-grow truncate text-base font-medium">{i.title}</span>
                    <Chip tone={IDEA_TONE[i.stage]}>{IDEA_STAGE[i.stage]}</Chip>
                    <Who actor={i.created_by} />
                  </span>
                  <span className="truncate text-base-sm text-text-secondary">
                    {i.told ? `${i.told} kişiye anlatıldı · ${i.interested} ilgilendi (${pct(i.interest_rate)})` : "Henüz kimseye anlatılmadı"}
                    {i.sectors.length ? ` · ${i.sectors.map((s) => s.path).join(", ")}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </section>
          {selId ? <IdeaCard key={selId} id={selId} /> : null}
        </>
      )}
    </Page>
  );
}

type Related = { people?: Interest[]; touches?: Touch[]; posts?: Post[] };

function IdeaCard({ id }: { id: number }) {
  const d = useQuery<Detail<Idea, Related>>(`/ideas/${id}?with=people,touches,posts`);
  const i = d.data?.row;
  if (!i) {
    return (
      <aside className="card detail p-9" aria-busy={!d.error}>
        {d.error ? <ErrorBox error={d.error} retry={d.reload} /> : <div className="h-chart-height" />}
      </aside>
    );
  }
  const people = d.data!.related.people ?? [];
  const touches = d.data!.related.touches ?? [];
  const posts = d.data!.related.posts ?? [];
  const move = (stage: string) => stage !== i.stage && run("patch", `/ideas/${i.id}`, { stage }, { ok: `Aşama: ${IDEA_STAGE[stage]}` }).catch(() => {});
  const remove = () => {
    void trash(`/ideas/${i.id}`, `“${i.title}” fikri`).catch(() => {});
  };

  return (
    <aside className="card slide-in flex flex-col gap-8 p-9" aria-label="Fikir">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="m-0 text-lg font-semibold">{i.title}</h2>
          <Who actor={i.created_by} />
        </div>
        {i.problem ? <p className="m-0 text-base leading-normal text-text-body">{i.problem}</p> : <span className="text-base-sm text-text-muted">Çözdüğü sorun yazılmadı</span>}
        {i.sectors.length ? <div className="mt-1 flex flex-wrap gap-2">{i.sectors.map((s) => <Chip key={s.id} tone="source">{s.path}</Chip>)}</div> : null}
      </div>

      <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Aşama">
        {IDEA_STAGES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={i.stage === s} className="fchip h-control-height-xs" onClick={() => move(s)}>{IDEA_STAGE[s]}</button>
        ))}
      </div>

      <section className="grid grid-cols-3 gap-4" aria-label="İlgi ölçümü">
        {[
          { label: "Anlatıldı", v: i.told },
          { label: "İlgilendi", v: i.interested },
          { label: "Oran", v: pct(i.interest_rate) },
        ].map((k, n) => (
          <div key={k.label} className="inset rise flex flex-col gap-1 px-6 py-5" style={order(n)}>
            <span className="text-sm text-text-secondary">{k.label}</span>
            <span className="kpi">{k.v}</span>
          </div>
        ))}
        {i.told ? (
          <div className="track col-span-3"><i className="grow-x bg-primary" style={{ width: `${Math.round((i.interest_rate ?? 0) * 100)}%` }} /></div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-pri" onClick={() => openSheet("touch", { idea_id: i.id })}>Anlattığım teması ekle</button>
        <button type="button" className="btn btn-sec" onClick={() => openSheet("post", { idea_id: i.id })}>Paylaşım ekle</button>
        <button type="button" className="btn btn-sec" onClick={() => openSheet("idea", { idea_id: i.id })}>Düzenle</button>
        <button type="button" className="btn btn-ghost" onClick={remove}>Sil</button>
      </div>

      <LinkPerson ideaId={i.id} />

      <section className="flex flex-col gap-3">
        <h3 className="m-0 text-base-sm font-medium text-text-secondary">Kime anlatıldı</h3>
        {people.length === 0 ? <span className="text-base-sm text-text-muted">Henüz kimse yok. Temas eklerken fikri seçince kişi buraya düşer.</span> : null}
        {people.map((x) => <InterestRow key={x.id} x={x} />)}
      </section>

      {touches.length ? (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-base-sm font-medium text-text-secondary">Temaslar</h3>
          {touches.map((t) => (
            <div key={t.id} className="flex flex-col gap-0.5 text-base-sm">
              <span className="text-text-secondary">{t.person_name} · {t.direction === "gelen" ? "gelen" : "giden"} {channelName(t.channel)} · {ago(t.happened_at)}</span>
              <span className="whitespace-pre-line text-text-body">{t.summary}</span>
            </div>
          ))}
        </section>
      ) : null}

      {posts.length ? (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-base-sm font-medium text-text-secondary">Paylaşımlar</h3>
          {posts.map((p) => (
            <Link key={p.id} href={`${PATHS.posts}/${p.id}`} className="text-base-sm">{PLATFORM[p.platform]} · {p.title} · {p.people_count} kişi</Link>
          ))}
        </section>
      ) : null}

      {i.notes ? <p className="inset m-0 whitespace-pre-line px-6 py-5 text-base-sm leading-normal text-text-body">{i.notes}</p> : null}
    </aside>
  );
}

function InterestRow({ x }: { x: Interest }) {
  const set = (interest: string) => interest !== x.interest && run("patch", `/ideas/people/${x.id}`, { interest }, { silent: true }).catch(() => {});
  const unlink = () => trash(`/ideas/people/${x.id}`, "Fikir bağı").catch(() => {});
  return (
    <div className="row flex flex-wrap items-center gap-3 py-3">
      <Link href={`${PATHS.people}/${x.person_id}`} className="min-w-0 flex-grow truncate text-base text-text-primary">
        {x.person_name}{x.company_name ? <span className="text-text-muted"> · {x.company_name}</span> : null}
      </Link>
      <div className="flex gap-2" role="radiogroup" aria-label={`${x.person_name} ilgisi`}>
        {Object.keys(INTEREST).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={x.interest === k} className={`chip border-0 ${x.interest === k ? "" : "opacity-muted"} ${INTEREST_TONE[k] === "success" ? "bg-chip-success-bg text-chip-success-fg" : INTEREST_TONE[k] === "warning" ? "bg-chip-warning-bg text-chip-warning-fg" : "bg-chip-neutral-bg text-chip-neutral-fg"}`}
            onClick={() => set(k)}>
            {INTEREST[k]}
          </button>
        ))}
      </div>
      <button type="button" className="ibtn" aria-label="Bağı kaldır" onClick={unlink}>×</button>
      {x.note ? <span className="w-full text-sm text-text-secondary">{x.note}</span> : null}
    </div>
  );
}

function LinkPerson({ ideaId }: { ideaId: number }) {
  const options = usePersonOptions();
  const [person, setPerson] = useState<Ref>(emptyRef);
  const [level, setLevel] = useState("anlatildi");
  const [busy, setBusy] = useState(false);
  const ready = useMemo(() => !!person.id, [person]);
  const add = async () => {
    if (!person.id) return;
    setBusy(true);
    try {
      await run("post", `/ideas/${ideaId}/people`, { person_id: person.id, interest: level }, { ok: "Kişi fikre bağlandı" });
      setPerson(emptyRef);
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-0 flex-1"><Combo value={person} onChange={setPerson} options={options} placeholder="Kişi bağla" allowNew={false} /></div>
        <select className="inp w-auto" aria-label="İlgi" value={level} onChange={(e) => setLevel(e.target.value)}>
          {Object.keys(INTEREST).map((k) => <option key={k} value={k}>{INTEREST[k]}</option>)}
        </select>
        <button type="button" className="btn btn-sec" disabled={busy || !ready} onClick={add}>Bağla</button>
      </div>
    </div>
  );
}
