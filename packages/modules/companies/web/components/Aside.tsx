import type { ReactNode } from "react";
import type { CompanyCard } from "@kit/api/types";
import { Slot } from "@kit/app/modules/Slot";
import type { Project } from "@kit/api/types";
import type { CompanyView } from "../companies";
import { fmtDayLong, lira } from "@kit/lib/format";
import { CONTACT_STATUS, OPEN_STAGES } from "@kit/lib/labels";
import { profileUrl, webUrl } from "@kit/lib/network";
import { Tags } from "@kit/components/ui";
import { m as kit } from "@kit/messages";
import { m } from "../messages";
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
    { k: kit.nouns.sector, v: c.sectors.map((s) => s.path).join(", ") || m.aside.none },
    !!c.city && { k: m.fields.location, v: c.city },
    !!c.source_name && { k: kit.nouns.source, v: c.source_name },
    !!first && { k: m.fields.firstTouch, v: fmtDayLong(first) },
    { k: m.fields.contactStatus, v: CONTACT_STATUS[c.contact_status] ?? c.contact_status },
    !!c.email && { k: m.fields.email, v: <a href={`mailto:${c.email}`}>{c.email}</a> },
    !!c.phone && { k: m.fields.phone, v: <a href={`tel:${c.phone}`}>{c.phone}</a> },
    !!c.website && { k: m.fields.web, v: ext(webUrl(c.website), c.website) },
    !!c.instagram && { k: m.fields.instagram, v: ext(profileUrl("instagram", c.instagram), c.instagram) },
    !!c.linkedin && { k: m.fields.linkedin, v: ext(profileUrl("linkedin", c.linkedin), c.linkedin) },
    c.tag_ids.length > 0 && { k: kit.nouns.tags, v: <span className="flex flex-wrap justify-end gap-2"><Tags ids={c.tag_ids} /></span> },
    !!c.notes && { k: kit.nouns.notes, v: <span className="whitespace-pre-line">{c.notes}</span>, block: true },
  ];
  return list.filter((f): f is Fact => !!f);
}

/** Left column of the company overlay: money block, facts, projects and open opportunities */
export function Aside({ v, max, card, projects }: { v: CompanyView; max: number; card?: CompanyCard; projects: Project[] }) {
  const { money } = v;
  const open = (card?.opportunities ?? []).filter((o) => OPEN_STAGES.includes(o.stage));
  return (
    <div className="co-aside">
      <div className="co-panel">
        <span className="co-panel-title">{m.aside.toYou}</span>
        <span className="co-big">{lira(money.won)}</span>
        <MoneyBar money={money} max={max} large />
        <div className="co-trio">
          <span data-k="won"><small>{m.money.won}</small><b>{lira(money.won)}</b></span>
          <span data-k="due"><small>{m.money.due}</small><b>{lira(money.due)}</b></span>
          <span><small>{m.money.open}</small><b>{lira(money.open)}</b></span>
        </div>
      </div>

      <div className="co-panel is-facts">
        {facts(v, card).map((f) => <div key={f.k} className={`co-fact ${f.block ? "is-block" : ""}`}><span>{f.k}</span><span>{f.v}</span></div>)}
      </div>

      <div className="co-panel is-work">
        <span className="co-panel-title">{m.aside.work}</span>
        <Slot name="company.overlay.work" props={{ projects, opportunities: open }} />
        {!projects.length && !open.length ? <span className="text-base-sm text-text-muted">{m.aside.noWork}</span> : null}
        <Slot name="company.overlay.work.after" props={{ card }} />
      </div>
    </div>
  );
}
