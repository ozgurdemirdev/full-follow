import type { PersonCard } from "@kit/api/types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { Slot } from "@kit/app/modules/Slot";
import { tl } from "@kit/lib/format";
import { Section } from "@kit/components/contact";
import { m } from "../messages";

function ReferralValueLine({ v }: { v: NonNullable<PersonCard["referral_value"]> }) {
  const parts = [
    m.extras.valueIntroduced(v.direct, v.network),
    m.extras.valueOpps(v.opps),
    v.won ? m.extras.valueWon(v.won, tl(v.won_value)) : "",
    v.open_value ? m.extras.valueOpen(tl(v.open_value)) : "",
    v.collected ? m.extras.valueCollected(tl(v.collected)) : "",
  ].filter(Boolean);
  return <p className="m-0 text-base-sm text-text-primary"><span className="text-text-secondary">{m.extras.valueLabel}</span>{parts.join(m.sep)}</p>;
}

/**
 * What the old person card had beyond the board: referral network, the deals and projects and the marketing links (rows other modules
 * contribute through the slots `person.overlay.deals` and `person.overlay.marketing`), the free note, the timeline link
 */
export function PersonExtras({ card }: { card: PersonCard }) {
  const p = card.row;
  return (
    <>
      <div className="ppl-panel">
        <Section title={m.referralNetwork}>
          <span className="text-base-sm text-text-secondary">
            {card.referrer ? <RecordLink type="person" id={card.referrer.id}>{m.introducedBy(card.referrer.name)}</RecordLink> : m.foundDirectly}
          </span>
          {card.referrals.length ? (
            <div className="ml-1 flex flex-col gap-2 border-l-2 border-border-default py-1 pl-6">
              {card.referrals.map((r) => (
                <RecordLink key={r.id} type="person" id={r.id} className="flex flex-wrap items-baseline gap-2 text-base-sm text-text-neutral-chip">
                  <span className="text-text-muted">{m.extras.introduced}</span> {r.name}
                  {r.company_name ? <span className="text-text-muted">{r.company_name}</span> : null}
                  {r.opps ? <span className="text-text-secondary">{m.extras.oppsLine(r.opps, r.won)}</span> : null}
                  {r.network ? <span className="text-text-muted">{m.extras.networkLine(r.network)}</span> : null}
                </RecordLink>
              ))}
            </div>
          ) : null}
          {card.referral_value ? <ReferralValueLine v={card.referral_value} /> : null}
        </Section>
      </div>

      {card.opportunities.length + card.projects.length + card.drafts.length ? (
        <div className="ppl-panel">
          <Section title={m.extras.sales}>
            <Slot name="person.overlay.deals" props={{ card }} />
          </Section>
        </div>
      ) : null}

      {card.post || card.ideas.length ? (
        <div className="ppl-panel">
          <Section title={m.extras.marketing}>
            <Slot name="person.overlay.marketing" props={{ card }} />
          </Section>
        </div>
      ) : null}

      {p.notes ? <p className="ppl-panel m-0 whitespace-pre-line text-base-sm leading-normal text-text-primary">{p.notes}</p> : null}
      <Slot name="person.overlay.side" props={{ type: "person", id: p.id, className: "text-base-sm", label: m.timelineLink }} />
    </>
  );
}
