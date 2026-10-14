import { memo, useState } from "react";
import { Link } from "wouter";
import { remove, run } from "../../api/actions";
import type { Opportunity } from "../../api/types";
import { opportunityPath, PATHS } from "../../app/routes";
import { openSheet } from "../../app/ui";
import { fmtDay, lira, todayIso } from "../../lib/format";
import { STAGE, type OppStage } from "../../lib/labels";
import { ageMeter, isLive, percentOf, useStageRules } from "../../lib/pipeline";
import { BoardIcon } from "../boardIcons";
import { Meter } from "../ui";

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
  const live = isLive(o);
  const rules = useStageRules();
  const age = live ? ageMeter(o, rules) : null;
  const title = o.company_name ?? o.title;
  const sub = `${o.company_name ? `${o.title} · ` : ""}${o.person_name}`;

  const draft = async () => {
    if (asked) return;
    setAsked(true);
    try {
      await run("post", "/tasks", {
        title: `${title} için takip taslağı hazırla`, assignee: "claude", due_date: todayIso(), opportunity_id: o.id,
      }, { ok: "Claude taslağı yazıyor, Taslaklar’a düşecek" });
    } catch {
      setAsked(false);
    }
  };

  return (
    <article data-record={`opportunity-${o.id}`} className={`pipe-card ${overlay ? "is-overlay" : ""}`} data-late={age?.late || undefined} aria-roledescription="sürüklenebilir kart">
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
              <Meter value={age.share} size="sm" className="flex-grow" color={age.late ? "bg-warning" : "bg-text-muted"} label="Aşamada geçen süre" />
              <span className={`whitespace-nowrap text-xs ${age.late ? "text-warning" : "text-text-muted"}`}>{age.days} gün{age.late ? ", bayatladı" : ""}</span>
            </span>
            {next ? (
              <span className="pipe-next"><BoardIcon name="arrowRight" className="size-icon-sm flex-none" stroke={2.2} />{next}</span>
            ) : null}
          </>
        ) : null}
        <span className="sr-only">Ayrıntılar</span>
        {o.stage === "kaybedildi" && o.lost_reason ? <span className="text-sm text-danger-soft">{o.lost_reason}</span> : null}
      </button>
      {o.stage === "kazanildi" && o.project_id ? (
        <Link href={`${PATHS.projects}/${o.project_id}`} draggable={false} className="pipe-won">
          Projeye dönüştü
          <svg className="size-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={OUT_PATH} /></svg>
        </Link>
      ) : null}
      {open ? (
        <div className="pipe-more">
          <span className="pipe-kv"><span>Kaynak</span><span>{o.source_name}</span></span>
          {o.source_url ? <a href={o.source_url} target="_blank" rel="noreferrer" draggable={false} className="truncate text-sm">İlan{o.source_date ? ` · ${fmtDay(o.source_date)}` : ""} ↗</a> : o.source_date ? <span className="pipe-kv"><span>İlan</span><span>{fmtDay(o.source_date)}</span></span> : null}
          {live ? <span className="pipe-kv"><span>Kazanma ihtimali</span><span>{percentOf(o.stage, rules)}</span></span> : null}
          {hint ? <span className="pipe-hint">{hint}</span> : null}
          {mobile ? (
            <select className="inp h-control-height-sm w-auto" aria-label="Aşamayı değiştir" value={o.stage} onChange={(e) => onMove?.(o.id, e.target.value as OppStage)}>
              {MOVE_TARGETS.map((s) => <option key={s} value={s}>{STAGE[s]}</option>)}
            </select>
          ) : null}
          <span className="pipe-actions">
            <button type="button" className="pipe-btn is-claude" disabled={asked} onClick={() => void draft()}>{asked ? "Taslak istendi" : "Claude takip yazsın"}</button>
            <Link href={`${PATHS.people}/${o.person_id}`} className="pipe-btn">Kişi</Link>
          </span>
          <span className="pipe-actions">
            <button type="button" className="pipe-btn is-quiet" onClick={() => openSheet("opportunity", { edit: o.id })}>Düzenle</button>
            {o.project_id ? null : <button type="button" className="pipe-btn is-danger" onClick={() => void remove(`/opportunities/${o.id}`, o.title).catch(() => {})}>Sil</button>}
          </span>
        </div>
      ) : null}
    </article>
  );
});
