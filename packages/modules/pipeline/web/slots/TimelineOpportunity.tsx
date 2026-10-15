import { useState } from "react";
import { Link, useLocation } from "wouter";
import { remove, run } from "@kit/api/actions";
import type { Detail, Opportunity } from "@kit/api/types";
import { useRegistry } from "@kit/app/modules/registry";
import { PATHS } from "@kit/app/routes";
import { openSheet } from "@kit/app/ui";
import { EditDelete } from "@kit/components/contact";
import { Chip, Who } from "@kit/components/ui";
import { fmtDay, tl } from "@kit/lib/format";
import { useRecordHref } from "@kit/lib/useRecordHref";
import { OPEN_STAGES, STAGE, STAGE_TONE, type OppStage } from "@kit/lib/labels";
import { m } from "../messages";

/** The opportunity's summary beside the timeline of a focused opportunity: stage moves, the contact, the project (the `timeline.aside` slot) */
export default function TimelineOpportunity({ type, detail }: { type: string; detail: Detail<any> }) {
  const [busy, setBusy] = useState(false);
  const [, navigate] = useLocation();
  const { pagePath } = useRegistry();
  const recordHref = useRecordHref();
  if (type !== "opportunity") return null;
  const o = detail.row as Opportunity;
  const del = () => remove(`/opportunities/${o.id}`, o.title).then(() => navigate(pagePath("pipeline") ?? PATHS.today)).catch(() => {});
  const move = async (stage: OppStage) => {
    let reason: string | undefined;
    if (stage === "kaybedildi") {
      reason = window.prompt(m.lost.title)?.trim();
      if (!reason) return;
    }
    setBusy(true);
    try {
      await run("post", `/opportunities/${o.id}/move`, { stage, reason }, { ok: m.opportunity.stageSet(STAGE[stage]) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card rise flex flex-col gap-6 p-8">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-grow flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-3 text-md font-semibold">{o.title}<Who actor={o.created_by} /></span>
          <span className="text-base-sm text-text-secondary">{m.aside.contact}<Link href={recordHref("person", o.person_id)}>{o.person_name}{o.company_name ? ` · ${o.company_name}` : ""}</Link></span>
        </div>
        <EditDelete label={o.title} onEdit={() => openSheet("opportunity", { edit: o.id })} onDelete={o.project_id ? undefined : del} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip tone="source">{o.source_name}</Chip>
        <Chip tone={STAGE_TONE[o.stage]}>{STAGE[o.stage]}{o.estimated_value ? ` · ${tl(o.estimated_value)}` : ""}</Chip>
      </div>
      {o.source_url || o.source_date ? (
        <p className="m-0 flex min-w-0 flex-wrap gap-2 text-base-sm">
          <span className="text-text-muted">{m.opportunity.listing(o.source_date ? fmtDay(o.source_date) : null)}</span>
          {o.source_url ? <a href={o.source_url} target="_blank" rel="noreferrer" className="min-w-0 truncate">{o.source_url}</a> : null}
        </p>
      ) : null}
      {o.lost_reason ? <p className="m-0 text-base-sm text-danger">{m.aside.reason}{o.lost_reason}</p> : null}
      <div className="flex flex-col gap-3">
        <span className="lab">{m.aside.change}</span>
        <div className="flex flex-wrap gap-2">
          {[...OPEN_STAGES, "kazanildi" as const, "kaybedildi" as const].map((s) => (
            <button key={s} type="button" className="fchip h-control-height-sm" aria-pressed={o.stage === s} disabled={busy || o.stage === s} onClick={() => move(s)}>
              {STAGE[s]}
            </button>
          ))}
        </div>
      </div>
      {o.project_id ? <Link href={recordHref("project", o.project_id)} className="btn btn-sec">{m.aside.toProject}</Link> : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-pri" onClick={() => openSheet("touch", { person_id: o.person_id, opportunity_id: o.id })}>{m.shared.addTouch}</button>
        <button type="button" className="btn btn-sec" onClick={() => openSheet("comment", { target: { type: "opportunity", id: o.id, label: o.title } })}>{m.aside.comment}</button>
      </div>
    </section>
  );
}
