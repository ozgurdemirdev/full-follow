import { memo, useState } from "react";
import { Link } from "wouter";
import { remove, run } from "@kit/api/actions";
import type { Opportunity } from "@kit/api/types";
import { useLinkTo } from "@kit/app/modules/registry";
import { openSheet } from "@kit/app/ui";
import { fmtDay, lira, todayIso } from "@kit/lib/format";
import { STAGE, type OppStage } from "@kit/lib/labels";
import { opportunityPath } from "../paths";
import { m } from "../messages";
import { ageMeter, isLive, percentOf, useStageRules } from "../pipeline";
import { BoardIcon } from "@kit/components/boardIcons";
import { useTasksOn } from "@kit/lib/taskAccess";
import { Meter } from "@kit/components/ui";
import { m as kit } from "@kit/messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** Stages a card can be moved to by the picker of the phone list */
const MOVE_TARGETS: OppStage[] = ["bulundu", "temas", "cevap", "gorusme", "teklif", "kazanildi", "kaybedildi"];
/** Path of the board's arrow that points out of the page */
const OUT_PATH = "M7 17 17 7M9 7h8v8";

export interface OppCardProps {
  o: Opportunity;
  open: boolean;
  /** latest open Claude comment on this opportunity */
  hint?: string;
  /** nearest open task, else the follow-up note */
  next?: string;
  /** phone list: no drag, a stage picker inside the details */
  mobile?: boolean;
  overlay?: boolean;
  onToggle?: (id: number) => void;
  onMove?: (id: number, stage: OppStage) => void;
}

/** One deal: company, person, value, age against the stage's stale limit, next step, and expandable details */
export const OppCard = memo(function OppCard({ o, open, hint, next, mobile, overlay, onToggle, onMove }: OppCardProps) {
  const [asked, setAsked] = useState(false);
  const tasksOn = useTasksOn();
  const live = isLive(o);
  const rules = useStageRules();
  const age = live ? ageMeter(o, rules) : null;
  const linkTo = useLinkTo();
  const projectHref = o.project_id ? linkTo("project", o.project_id) : null;
  const personHref = linkTo("person", o.person_id);
  const title = o.company_name ?? o.title;
  const sub = `${o.company_name ? `${o.title} · ` : ""}${o.person_name}`;

  const draft = async () => {
    if (asked) return;
    setAsked(true);
    try {
      await run("post", "/tasks", {
        title: m.card.claudeTask(title), assignee: "claude", due_date: todayIso(), opportunity_id: o.id,
      }, { ok: m.card.draftQueued });
    } catch {
      setAsked(false);
    }
  };

  return (
    <article data-record={`opportunity-${o.id}`} className={`pipe-card ${overlay ? "is-overlay" : ""}`} data-late={age?.late || undefined} aria-roledescription={m.card.dragLabel}>
      <div className="pipe-card-top">
        <Link href={opportunityPath(o.id)} draggable={false} className="pipe-card-title">
          <span className="truncate text-base font-medium">{title}</span>
          <span className="truncate text-sm text-text-secondary">{sub}</span>
        </Link>
        {o.estimated_value ? <span className="whitespace-nowrap text-base tracking-subtitle">{lira(o.estimated_value)}</span> : null}
      </div>
      <button type="button" className="pipe-card-toggle" aria-expanded={open} onClick={() => onToggle?.(o.id)}>
        {age ? (
          <>
            <span className="pipe-card-meta">
              <Meter value={age.share} size="sm" className="flex-grow" color={age.late ? "bg-warning" : "bg-text-muted"} label={m.card.ageLabel} />
              <span className={`whitespace-nowrap text-xs ${age.late ? "text-warning" : "text-text-muted"}`}>{m.card.days(age.days, age.late)}</span>
            </span>
            {next ? (
              <span className="pipe-next"><BoardIcon name="arrowRight" className="size-icon-sm flex-none" stroke={STROKE.medium} />{next}</span>
            ) : null}
          </>
        ) : null}
        <span className="sr-only">{m.card.details}</span>
        {o.stage === "kaybedildi" && o.lost_reason ? <span className="text-sm text-danger-soft">{o.lost_reason}</span> : null}
      </button>
      {o.stage === "kazanildi" && projectHref ? (
        <Link href={projectHref} draggable={false} className="pipe-won">
          {m.card.projectDone}
          <svg className="size-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE.bold} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={OUT_PATH} /></svg>
        </Link>
      ) : null}
      {open ? (
        <div className="pipe-more">
          <span className="pipe-kv"><span>{m.card.source}</span><span>{o.source_name}</span></span>
          {o.source_url ? <a href={o.source_url} target="_blank" rel="noreferrer" draggable={false} className="truncate text-sm">{m.card.listingLink(o.source_date ? fmtDay(o.source_date) : null)}</a> : o.source_date ? <span className="pipe-kv"><span>{m.card.listing}</span><span>{fmtDay(o.source_date)}</span></span> : null}
          {live ? <span className="pipe-kv"><span>{m.card.chance}</span><span>{percentOf(o.stage, rules)}</span></span> : null}
          {hint ? <span className="pipe-hint">{hint}</span> : null}
          {mobile ? (
            <select className="inp h-control-height-sm w-auto" aria-label={m.card.changeStage} value={o.stage} onChange={(e) => onMove?.(o.id, e.target.value as OppStage)}>
              {MOVE_TARGETS.map((s) => <option key={s} value={s}>{STAGE[s]}</option>)}
            </select>
          ) : null}
          <span className="pipe-actions">
            {tasksOn ? <button type="button" className="pipe-btn is-claude" disabled={asked} onClick={() => void draft()}>{asked ? m.card.asked : m.card.askDraft}</button> : null}
            {personHref ? <Link href={personHref} className="pipe-btn">{m.card.person}</Link> : null}
          </span>
          <span className="pipe-actions">
            <button type="button" className="pipe-btn is-quiet" onClick={() => openSheet("opportunity", { edit: o.id })}>{kit.edit}</button>
            {o.project_id ? null : <button type="button" className="pipe-btn is-danger" onClick={() => void remove(`/opportunities/${o.id}`, o.title).catch(() => {})}>{kit.delete}</button>}
          </span>
        </div>
      ) : null}
    </article>
  );
});
