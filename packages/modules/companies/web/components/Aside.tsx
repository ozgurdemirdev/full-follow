import type { ReactNode } from "react";
import type { CompanyCard } from "@kit/api/types";
import { Slot } from "@kit/app/modules/Slot";
import type { CompanyView } from "../companies";
import { fmtDayLong, lira } from "@kit/lib/format";
import { CONTACT_STATUS, OPEN_STAGES } from "@kit/lib/labels";
import { profileUrl, webUrl } from "@kit/lib/network";
import { Tags } from "@kit/components/ui";
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
  const open = (card?.opportunities ?? []).filter((o) => OPEN_STAGES.includes(o.stage));
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
        <Slot name="company.overlay.work" props={{ projects: v.projects, opportunities: open }} />
        {!v.projects.length && !open.length ? <span className="text-base-sm text-text-muted">Henüz proje ya da açık fırsat yok.</span> : null}
        <Slot name="company.overlay.work.after" props={{ card }} />
      </div>
    </div>
  );
}
