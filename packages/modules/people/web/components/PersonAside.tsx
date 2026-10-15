import type { PersonCard, Person } from "@kit/api/types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { Slot } from "@kit/app/modules/Slot";
import { fmtDay, lira } from "@kit/lib/format";
import { CONTACT_STATUS } from "@kit/lib/labels";
import { INFLUENCE_LABEL } from "../labels";
import { channelsOf } from "@kit/lib/people";
import { agoText, warmth, WARMTH_NAME } from "../people";
import { profileUrl } from "@kit/lib/network";
import { BoardIcon } from "@kit/components/boardIcons";
import { Fact } from "@kit/components/contact";
import { m as kit } from "@kit/messages";
import { m } from "../messages";
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
        <span className="text-base-sm text-text-secondary">{m.aside.rhythm}</span>
        <span className="ppl-warmtext text-sm">{WARMTH_NAME[warmth(p.days_since)]}</span>
      </div>
      <Rhythm weeks={p.rhythm} large />
      <span className="text-sm text-text-secondary">
        {m.aside.rhythmLine(p.last_touch_at ? m.aside.lastTouch(agoText(p.days_since)) : m.noTouch, p.rhythm.length, total)}
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
            <button type="button" className="ppl-chic" aria-pressed={chan === c.key} aria-label={m.aside.showChannel(c.label)}
              title={sum ? m.aside.channelSummary(sum.out_count, sum.in_count, fmtDay(sum.last_at)) : c.label} onClick={() => onChan(chan === c.key ? null : c.key)}
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
            <span className="text-sm text-text-muted">{kit.other}</span>
            <span className="truncate text-base-sm">{p.handle}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** The open deal (a slot of the pipeline module), how we met, referral value and the tags */
function Facts({ p, card }: { p: Person; card?: PersonCard }) {
  const v = card?.referral_value;
  const met = [
    card?.referrer ? <RecordLink key="r" type="person" id={card.referrer.id} className="text-text-soft">{m.aside.referrer(card.referrer.name)}</RecordLink> : null,
    p.source_name ? <span key="s">{p.source_name}</span> : null,
    card?.post ? <RecordLink key="p" type="post" id={card.post.id} className="text-text-soft">{m.aside.post(card.post.title)}</RecordLink> : null,
  ].filter(Boolean);
  return (
    <div className="ppl-panel">
      <Slot name="person.overlay.facts" props={{ card }} />
      <Fact label={m.aside.metHow}>
        {met.length ? met.map((part, i) => <span key={i}>{i ? m.sep : ""}{part}</span>) : m.foundDirectly}
      </Fact>
      <Fact label={m.aside.referralValue}>
        {v?.won ? <span className="text-accent">{m.aside.broughtWork(lira(v.won_value), v.won)}</span>
          : v ? <span className="text-text-secondary">{m.aside.introduced(v.direct)}</span>
          : <span className="text-text-muted">{m.aside.notYet}</span>}
      </Fact>
      <Fact label={m.fields.contactStatus}>{CONTACT_STATUS[p.contact_status] ?? p.contact_status}</Fact>
      {p.influence ? <Fact label={m.fields.influence}>{INFLUENCE_LABEL[p.influence]}</Fact> : null}
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
