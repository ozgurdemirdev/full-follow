import type { ReactNode } from "react";
import { Link } from "wouter";
import type { CompanyCard } from "../../api/types";
import { opportunityPath, PATHS, timelinePath } from "../../app/routes";
import type { CompanyView } from "../../lib/companies";
import { fmtDayLong, lira } from "../../lib/format";
import { CONTACT_STATUS, OPEN_STAGES, PROJECT_STAGE, STAGE } from "../../lib/labels";
import { profileUrl, webUrl } from "../../lib/network";
import { Tags } from "../ui";
import { MoneyBar } from "./MoneyBar";

interface Fact {
  k: string;
  v: ReactNode;
  /** long text: label above, value below, left aligned */
  block?: boolean;
}

const ext = (href: string, text: string) => <a href={href} target="_blank" rel="noreferrer">{text}</a>;

/** Facts the company has: only the filled ones are listed (the board lists sector, location and first touch) */
function facts(v: CompanyView, card?: CompanyCard): Fact[] {
  const c = v.c;
  const rows = card?.touches.rows ?? [];
  // the oldest touch is only known when the card holds all of them
  const first = card && rows.length && rows.length >= card.touches.total ? rows[rows.length - 1].happened_at : null;
  const list: (Fact | false | null | undefined | "")[] = [
    { k: "Sektör", v: c.sectors.map((s) => s.path).join(", ") || "Yok" },
    !!c.city && { k: "Konum", v: c.city },
    !!c.source_name && { k: "Kaynak", v: c.source_name },
    !!first && { k: "İlk temas", v: fmtDayLong(first) },
    { k: "Temas durumu", v: CONTACT_STATUS[c.contact_status] ?? c.contact_status },
    !!c.email && { k: "E-posta", v: <a href={`mailto:${c.email}`}>{c.email}</a> },
    !!c.phone && { k: "Telefon", v: <a href={`tel:${c.phone}`}>{c.phone}</a> },
    !!c.website && { k: "Web", v: ext(webUrl(c.website), c.website) },
    !!c.instagram && { k: "Instagram", v: ext(profileUrl("instagram", c.instagram), c.instagram) },
    !!c.linkedin && { k: "LinkedIn", v: ext(profileUrl("linkedin", c.linkedin), c.linkedin) },
    c.tag_ids.length > 0 && { k: "Etiketler", v: <span className="flex flex-wrap justify-end gap-2"><Tags ids={c.tag_ids} /></span> },
    !!c.notes && { k: "Notlar", v: <span className="whitespace-pre-line">{c.notes}</span>, block: true },
  ];
  return list.filter((f): f is Fact => !!f);
}

/** Left column of the company overlay: money block, facts, projects and open opportunities */
export function Aside({ v, max, card }: { v: CompanyView; max: number; card?: CompanyCard }) {
  const { money } = v;
  const opps = (card?.opportunities ?? []).filter((o) => OPEN_STAGES.includes(o.stage));
  const drafts = card?.drafts.length ?? 0;
  return (
    <div className="co-aside">
      <div className="co-panel">
        <span className="co-panel-title">Bu firma sana</span>
        <span className="co-big">{lira(money.won)}</span>
        <MoneyBar money={money} max={max} large />
        <div className="co-trio">
          <span data-k="won"><small>Kazanılan</small><b>{lira(money.won)}</b></span>
          <span data-k="due"><small>Bekleyen</small><b>{lira(money.due)}</b></span>
          <span><small>Açık fırsat</small><b>{lira(money.open)}</b></span>
        </div>
      </div>

      <div className="co-panel is-facts">
        {facts(v, card).map((f) => <div key={f.k} className={`co-fact ${f.block ? "is-block" : ""}`}><span>{f.k}</span><span>{f.v}</span></div>)}
      </div>

      <div className="co-panel is-work">
        <span className="co-panel-title">Projeler ve fırsatlar</span>
        {v.projects.map((p) => (
          <Link key={`p${p.id}`} href={timelinePath("project", p.id)} className="co-work" data-k="won">
            <i />
            <span className="flex min-w-0 flex-grow flex-col"><b>{p.name}</b><small>{PROJECT_STAGE[p.stage]}</small></span>
            <em>{lira(p.price)}</em>
          </Link>
        ))}
        {opps.map((o) => (
          <Link key={`o${o.id}`} href={opportunityPath(o.id)} className="co-work" data-k="open">
            <i />
            <span className="flex min-w-0 flex-grow flex-col"><b>{o.title}</b><small>{STAGE[o.stage]} · {o.person_name}</small></span>
            {o.estimated_value ? <em>{lira(o.estimated_value)}</em> : null}
          </Link>
        ))}
        {!v.projects.length && !opps.length ? <span className="text-base-sm text-text-muted">Henüz proje ya da açık fırsat yok.</span> : null}
        {drafts ? <Link href={PATHS.drafts} className="text-base-sm">{drafts} taslak onay bekliyor</Link> : null}
      </div>
    </div>
  );
}
