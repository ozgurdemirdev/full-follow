import type { ReactNode } from "react";
import { Link } from "wouter";
import type { PersonCard, Person } from "../../api/types";
import { PATHS, opportunityPath } from "../../app/routes";
import { INFLUENCE_LABEL } from "../../lib/companies";
import { fmtDay, lira } from "../../lib/format";
import { CONTACT_STATUS, OPEN_STAGES, STAGE } from "../../lib/labels";
import { agoText, channelsOf, warmth, WARMTH_NAME } from "../../lib/people";
import { profileUrl } from "../../lib/network";
import { BoardIcon } from "../boardIcons";
import { Rhythm } from "./Rhythm";

const HREF: Record<string, (v: string) => string> = {
  email: (v) => `mailto:${v}`,
  telefon: (v) => `tel:${v}`,
  instagram: (v) => profileUrl("instagram", v),
  linkedin: (v) => profileUrl("linkedin", v),
};

/** Rhythm chart: the last 12 weeks, the warmth word and the totals */
function RhythmPanel({ p }: { p: Person }) {
  const total = p.rhythm.reduce((a, b) => a + b, 0);
  return (
    <div className="ppl-panel" data-warm={warmth(p.days_since)}>
      <div className="flex items-baseline justify-between">
        <span className="text-base-sm text-text-secondary">İlişki ritmi</span>
        <span className="ppl-warmtext text-sm">{WARMTH_NAME[warmth(p.days_since)]}</span>
      </div>
      <Rhythm weeks={p.rhythm} large />
      <span className="text-sm text-text-secondary">
        {p.last_touch_at ? `Son temas ${agoText(p.days_since)}` : "Henüz temas yok"} · {p.rhythm.length} haftada {total} temas
      </span>
    </div>
  );
}

/** Channels with the accounts; the round button shows only that channel in the stream */
function Channels({ p, card, chan, onChan }: { p: Person; card?: PersonCard; chan: string | null; onChan: (c: string | null) => void }) {
  const rows = channelsOf(p);
  if (!rows.length && !p.handle) return null;
  return (
    <div className="ppl-panel is-list">
      {rows.map((c) => {
        const handle = c.handle(p)!;
        const sum = card?.channels.find((x) => x.channel === c.key);
        return (
          <div key={c.key} className="ppl-chrow">
            <button type="button" className="ppl-chic" aria-pressed={chan === c.key} aria-label={`${c.label} temaslarını göster`}
              title={sum ? `${sum.out_count} giden, ${sum.in_count} gelen · son ${fmtDay(sum.last_at)}` : c.label} onClick={() => onChan(chan === c.key ? null : c.key)}
              data-on={chan === c.key}>
              <BoardIcon name={c.icon} className="size-icon-xs" />
            </button>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm text-text-muted">{c.label}</span>
              <a className="truncate text-base-sm" href={HREF[c.key](handle)} target={c.key === "email" || c.key === "telefon" ? undefined : "_blank"} rel="noreferrer">{handle}</a>
            </span>
          </div>
        );
      })}
      {p.handle ? (
        <div className="ppl-chrow">
          <span className="ppl-chic"><BoardIcon name="link" className="size-icon-xs" /></span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm text-text-muted">Diğer</span>
            <span className="truncate text-base-sm">{p.handle}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm text-text-muted">{label}</span>
    <span className="text-base">{children}</span>
  </div>
);

/** Open deal, how we met, referral value and the tags */
function Facts({ p, card }: { p: Person; card?: PersonCard }) {
  const deal = card?.opportunities.find((o) => OPEN_STAGES.includes(o.stage));
  const v = card?.referral_value;
  const met = [
    card?.referrer ? <Link key="r" href={`${PATHS.people}/${card.referrer.id}`} className="text-text-soft">Referans: {card.referrer.name}</Link> : null,
    p.source_name ? <span key="s">{p.source_name}</span> : null,
    card?.post ? <Link key="p" href={`${PATHS.posts}/${card.post.id}`} className="text-text-soft">Paylaşım: {card.post.title}</Link> : null,
  ].filter(Boolean);
  return (
    <div className="ppl-panel">
      <Fact label="Açık iş">
        {deal ? <Link href={opportunityPath(deal.id)} className="text-text-primary hover:text-text-primary">{deal.title} · {STAGE[deal.stage]}</Link> : "Yok"}
      </Fact>
      <Fact label="Nasıl tanıştık">
        {met.length ? met.map((m, i) => <span key={i}>{i ? " · " : ""}{m}</span>) : "Doğrudan bulundu"}
      </Fact>
      <Fact label="Referans değeri">
        {v?.won ? <span className="text-accent">{lira(v.won_value)} · {v.won} iş getirdi</span>
          : v ? <span className="text-text-secondary">{v.direct} kişi tanıttı</span>
          : <span className="text-text-muted">Henüz kimseyi getirmedi</span>}
      </Fact>
      <Fact label="Temas durumu">{CONTACT_STATUS[p.contact_status] ?? p.contact_status}</Fact>
      {p.influence ? <Fact label="Karar rolü">{INFLUENCE_LABEL[p.influence]}</Fact> : null}
      {p.tags.length || p.sectors.length ? (
        <div className="flex flex-wrap gap-2">
          {p.tags.map((t) => <span key={t} className="ppl-hash">#{t}</span>)}
          {p.sectors.map((s) => <span key={s.id} className="ppl-hash">{s.path}</span>)}
        </div>
      ) : null}
    </div>
  );
}

/** Left column of the person overlay */
export function PersonAside({ p, card, chan, onChan }: { p: Person; card?: PersonCard; chan: string | null; onChan: (c: string | null) => void }) {
  return (
    <>
      <RhythmPanel p={p} />
      <Channels p={p} card={card} chan={chan} onChan={onChan} />
      <Facts p={p} card={card} />
    </>
  );
}
