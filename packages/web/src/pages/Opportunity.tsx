import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { remove, run } from "../api/actions";
import { qs } from "../api/client";
import { useQuery } from "../api/store";
import type { Detail, FileRow, List, Offer, OppPerson, Opportunity as Opp, Task } from "../api/types";
import { Page } from "../app/Page";
import { PATHS, timelinePath } from "../app/routes";
import { openSheet } from "../app/ui";
import { EditDelete } from "../components/contact";
import { FeedComposer, FeedItems, useFeed, type FeedGroup } from "../components/Feed";
import { FilesCard } from "../components/FilesCard";
import { LinksCard } from "../components/LinksCard";
import { LostReason } from "../components/LostReason";
import { NextStep } from "../components/NextStep";
import { OffersCard } from "../components/OffersCard";
import { TeamCard } from "../components/TeamCard";
import { Chip, ErrorBox, Filters, PageSkeleton, Who } from "../components/ui";
import { fmtDay, tl } from "../lib/format";
import { OPEN_STAGES, STAGE, STAGE_BG, type OppStage } from "../lib/labels";

type Related = { people?: OppPerson[]; offers?: Offer[]; files?: FileRow[] };
/** Stage bar: the open stages, then the two ways an opportunity ends */
const BAR_STAGES: OppStage[] = [...OPEN_STAGES, "kazanildi", "kaybedildi"];
/** Feed filter chips of the opportunity page (events outside these groups only show under "Hepsi") */
const FEED_GROUPS: FeedGroup[] = ["Temaslar", "Yorumlar", "Aşama"];

export default function Opportunity() {
  const id = Number(useParams<{ id: string }>().id);
  return <OpportunityPage key={id} id={id} />;
}

function OpportunityPage({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const detail = useQuery<Detail<Opp, Related>>(`/opportunities/${id}?with=people,offers,files`);
  const tasks = useQuery<List<Task>>(`/tasks${qs({ opportunity_id: id, limit: 50 })}`);
  const { events, items, commentById, openThread } = useFeed("opportunity", id);
  const [filter, setFilter] = useState<FeedGroup | "Hepsi">("Hepsi");
  const [lostAsk, setLostAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  const o = detail.data?.row;
  if (detail.error && !detail.data) return <Page title="Fırsat"><ErrorBox error={detail.error} retry={detail.reload} /></Page>;
  if (!o) return <Page title="Fırsat"><PageSkeleton /></Page>;

  const files = detail.data?.related.files ?? [];
  const shown = filter === "Hepsi" ? items : items.filter((x) => x.k.group === filter);
  const move = async (stage: OppStage, reason?: string) => {
    setBusy(true);
    try {
      await run("post", `/opportunities/${id}/move`, { stage, reason }, { ok: `Aşama: ${STAGE[stage]}` });
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  const del = () => remove(`/opportunities/${id}`, o.title).then(() => navigate(PATHS.pipeline)).catch(() => {});

  return (
    <Page
      title={o.title}
      sub={<>
        <Link href={`${PATHS.people}/${o.person_id}`}>{o.person_name}</Link>
        {o.company_name ? <> · <Link href={`${PATHS.companies}/${o.company_id}`}>{o.company_name}</Link></> : null}
      </>}
      right={<EditDelete label={o.title} onEdit={() => openSheet("opportunity", { edit: id })} onDelete={o.project_id ? undefined : del} />}
      className="flex flex-col gap-7"
    >
      <section className="card rise flex flex-col gap-6 p-8" aria-label="Fırsat özeti">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-col">
            <span className="font-mono text-xl font-semibold">{tl(o.estimated_value)}</span>
            <span className="text-sm text-text-secondary">Tahmini değer, KDV hariç</span>
          </div>
          <Chip tone="source">{o.source_name}</Chip>
          <Who actor={o.created_by} />
          {o.source_url || o.source_date ? (
            <span className="flex min-w-0 flex-wrap gap-2 text-base-sm">
              <span className="text-text-muted">İlan{o.source_date ? ` · ${fmtDay(o.source_date)}` : ""}</span>
              {o.source_url ? <a href={o.source_url} target="_blank" rel="noreferrer" className="min-w-0 truncate">{o.source_url} ↗</a> : null}
            </span>
          ) : null}
        </div>
        <div className="-mx-8 overflow-x-auto px-8" role="group" aria-label="Aşama">
          <div className="flex w-max gap-2">
            {BAR_STAGES.map((s) => (
              <button key={s} type="button" className="fchip h-control-height-sm flex-none gap-3" aria-pressed={o.stage === s} disabled={busy || o.stage === s}
                onClick={() => (s === "kaybedildi" ? setLostAsk(true) : void move(s))}>
                <span className={`dot ${STAGE_BG[s]}`} />{STAGE[s]}
              </button>
            ))}
          </div>
        </div>
        {o.lost_reason ? <p className="m-0 text-base-sm text-status-text-danger">Neden: {o.lost_reason}</p> : null}
        <div className="flex flex-wrap gap-3">
          {o.project_id ? <Link href={`${PATHS.projects}/${o.project_id}`} className="btn btn-pri">Projeye git</Link> : null}
          <button type="button" className="btn btn-sec" onClick={() => openSheet("touch", { person_id: o.person_id, opportunity_id: id })}>Temas ekle</button>
          <Link href={timelinePath("opportunity", id)} className="btn btn-ghost">Zaman çizelgesi</Link>
        </div>
      </section>

      {/* telefonda tek sütun ve order ile sıralanır (sıradaki adım, teklifler, ekip, dosyalar, linkler, akış); masaüstünde iki sütun */}
      <div className="grid grid-cols-1 gap-7 desk:grid-cols-[minmax(0,1fr)_var(--spacing-aside-panel)] desk:items-start">
        <div className="contents desk:col-start-1 desk:flex desk:min-w-0 desk:flex-col desk:gap-7">
          <div className="order-2 desk:order-none">
            <OffersCard opportunityId={id} offers={detail.data?.related.offers ?? []} files={files} />
          </div>
          <section aria-label="Akış" className="order-6 flex min-w-0 flex-col gap-5 desk:order-none">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-md font-semibold">Akış</span>
              <span className="flex-grow" />
              <Filters label="Olay türü" value={filter} onChange={setFilter} items={[{ value: "Hepsi" as const, label: "Hepsi" }, ...FEED_GROUPS.map((g) => ({ value: g, label: g }))]} />
            </div>
            <div className="flex flex-col">
              <FeedItems items={shown} commentById={commentById} loaded={!!events.data} />
              <FeedComposer type="opportunity" id={id} label={o.title} openThread={openThread} />
            </div>
          </section>
        </div>
        <div className="contents desk:col-start-2 desk:flex desk:flex-col desk:gap-7">
          <div className="order-1 desk:order-none">
            <NextStep tasks={tasks.data?.rows ?? []} type="opportunity" id={id} personId={o.person_id} followUp={o.next_follow_up_at} />
          </div>
          <div className="order-3 desk:order-none"><TeamCard opp={o} team={detail.data?.related.people ?? []} /></div>
          <div className="order-4 desk:order-none"><FilesCard type="opportunity" id={id} files={files} /></div>
          <div className="order-5 desk:order-none"><LinksCard type="opportunity" id={id} /></div>
        </div>
      </div>

      <LostReason
        open={lostAsk}
        onCancel={() => setLostAsk(false)}
        onSave={(reason) => {
          setLostAsk(false);
          void move("kaybedildi", reason);
        }}
      />
    </Page>
  );
}
