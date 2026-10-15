import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { remove, run } from "@kit/api/actions";
import { useQuery } from "@kit/api/store";
import type { Detail, FileRow, Offer, OppPerson, Opportunity as Opp } from "@kit/api/types";
import { Page } from "@kit/app/Page";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { useLinkTo } from "@kit/app/modules/registry";
import { Slot } from "@kit/app/modules/Slot";
import { openSheet } from "@kit/app/ui";
import { EditDelete } from "@kit/components/contact";
import { FilesCard } from "@kit/components/FilesCard";
import { LinksCard } from "@kit/components/LinksCard";
import { LostReason } from "../components/LostReason";
import { OffersCard } from "../components/OffersCard";
import { TeamCard } from "../components/TeamCard";
import { Card, Chip, ErrorBox, Filters, PageSkeleton, Who } from "@kit/components/ui";
import { fmtDay, lira, tl } from "@kit/lib/format";
import { OPEN_STAGES, STAGE, type OppStage } from "@kit/lib/labels";
import { STAGE_BG } from "../labels";
import { PIPELINE_PATH } from "../paths";

type Related = { people?: OppPerson[]; offers?: Offer[]; files?: FileRow[] };
/** Stage bar: the open stages, then the two ways an opportunity ends */
const BAR_STAGES: OppStage[] = [...OPEN_STAGES, "kazanildi", "kaybedildi"];

export default function Opportunity() {
  const id = Number(useParams<{ id: string }>().id);
  return <OpportunityPage key={id} id={id} />;
}

function OpportunityPage({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const linkTo = useLinkTo();
  const detail = useQuery<Detail<Opp, Related>>(`/opportunities/${id}?with=people,offers,files`);
  const [lostAsk, setLostAsk] = useState(false);
  const [busy, setBusy] = useState(false);

  const o = detail.data?.row;
  if (detail.error && !detail.data) return <Page title="Fırsat"><ErrorBox error={detail.error} retry={detail.reload} /></Page>;
  if (!o) return <Page title="Fırsat"><PageSkeleton /></Page>;

  const files = detail.data?.related.files ?? [];
  const projectHref = o.project_id ? linkTo("project", o.project_id) : null;
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
  const del = () => remove(`/opportunities/${id}`, o.title).then(() => navigate(PIPELINE_PATH)).catch(() => {});

  return (
    <Page
      title={o.title}
      sub={<>
        <RecordLink type="person" id={o.person_id}>{o.person_name}</RecordLink>
        {o.company_name && o.company_id ? <> · <RecordLink type="company" id={o.company_id}>{o.company_name}</RecordLink></> : null}
      </>}
      right={<EditDelete label={o.title} onEdit={() => openSheet("opportunity", { edit: id })} onDelete={o.project_id ? undefined : del} />}
      className="flex flex-col gap-7"
    >
      <Card label="Fırsat özeti" className="opp-summary rise">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-col">
            <span className="text-cal-num leading-none tracking-kpi">{o.estimated_value ? lira(o.estimated_value) : tl(null)}</span>
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
        <Filters label="Aşama" value={o.stage} onChange={(s) => !busy && (s === "kaybedildi" ? setLostAsk(true) : void move(s))}
          items={BAR_STAGES.map((s) => ({ value: s, label: STAGE[s], dot: STAGE_BG[s] }))} />
        {o.lost_reason ? <p className="m-0 text-base-sm text-danger-soft">Neden: {o.lost_reason}</p> : null}
        <div className="flex flex-wrap gap-3">
          {projectHref ? <Link href={projectHref} className="dash-btn is-primary">Projeye git</Link> : null}
          <button type="button" className="dash-btn" onClick={() => openSheet("touch", { person_id: o.person_id, opportunity_id: id })}>Temas ekle</button>
          <Slot name="opportunity.actions" props={{ type: "opportunity", id, className: "dash-btn is-ghost", label: "Zaman çizelgesi" }} />
        </div>
      </Card>

      {/* telefonda tek sütun ve order ile sıralanır (sıradaki adım, teklifler, ekip, dosyalar, linkler, akış); masaüstünde iki sütun */}
      <div className="grid grid-cols-1 gap-7 desk:grid-cols-[minmax(0,1fr)_var(--spacing-aside-panel)] desk:items-start">
        <div className="contents desk:col-start-1 desk:flex desk:min-w-0 desk:flex-col desk:gap-7">
          <div className="order-2 desk:order-none">
            <OffersCard opportunityId={id} offers={detail.data?.related.offers ?? []} files={files} />
          </div>
          <Slot name="opportunity.main" props={{ id, label: o.title, className: "order-6 flex min-w-0 flex-col gap-5 desk:order-none" }} />
        </div>
        <div className="contents desk:col-start-2 desk:flex desk:flex-col desk:gap-7">
          <Slot name="opportunity.side" props={{ id, personId: o.person_id, followUp: o.next_follow_up_at, className: "order-1 desk:order-none" }} />
          <div className="order-3 desk:order-none"><TeamCard opp={o} team={detail.data?.related.people ?? []} /></div>
          <div className="order-4 desk:order-none"><FilesCard type="opportunity" id={id} files={files} /></div>
          <div className="order-5 desk:order-none"><LinksCard type="opportunity" id={id} /></div>
        </div>
      </div>

      <LostReason
        open={lostAsk}
        name={o.company_name ?? o.title}
        onCancel={() => setLostAsk(false)}
        onSave={(reason) => {
          setLostAsk(false);
          void move("kaybedildi", reason);
        }}
      />
    </Page>
  );
}
