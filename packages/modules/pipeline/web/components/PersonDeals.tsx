import { Link } from "wouter";
import type { Opportunity, PersonCard } from "@kit/api/types";
import { Fact } from "@kit/components/contact";
import { Chip } from "@kit/components/ui";
import { lira, tl } from "@kit/lib/format";
import { OPEN_STAGES, STAGE, STAGE_TONE } from "@kit/lib/labels";
import { m } from "../messages";
import { opportunityPath } from "../paths";

/** The opportunities of a person as rows of the "Satış ve projeler" panel of the person overlay (slot "person.overlay.deals") */
export function PersonOpportunities({ card }: { card: PersonCard }) {
  return (
    <>
      {card.opportunities.map((o) => (
        <Link key={`o${o.id}`} href={opportunityPath(o.id)} className="flex items-center gap-3 text-text-primary hover:text-text-primary">
          <span className="min-w-0 flex-grow truncate text-base">{o.title}</span>
          {o.estimated_value ? <span className="font-mono text-base-sm text-text-secondary">{tl(o.estimated_value)}</span> : null}
          <Chip tone={STAGE_TONE[o.stage]}>{STAGE[o.stage]}</Chip>
        </Link>
      ))}
    </>
  );
}

/** The "Açık iş" fact at the top of the facts panel of the person overlay (slot "person.overlay.facts") */
export function PersonOpenDeal({ card }: { card?: PersonCard }) {
  const deal = card?.opportunities.find((o) => OPEN_STAGES.includes(o.stage));
  return (
    <Fact label={m.deals.openDeal}>
      {deal ? <Link href={opportunityPath(deal.id)} className="text-text-primary hover:text-text-primary">{deal.title} · {STAGE[deal.stage]}</Link> : m.deals.none}
    </Fact>
  );
}

/** The open opportunities of a company as rows of the "Projeler ve fırsatlar" panel of the company overlay (slot "company.overlay.work") */
export function CompanyOpportunities({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <>
      {opportunities.map((o) => (
        <Link key={`o${o.id}`} href={opportunityPath(o.id)} className="co-work" data-k="open">
          <i />
          <span className="flex min-w-0 flex-grow flex-col"><b>{o.title}</b><small>{STAGE[o.stage]} · {o.person_name}</small></span>
          {o.estimated_value ? <em>{lira(o.estimated_value)}</em> : null}
        </Link>
      ))}
    </>
  );
}
