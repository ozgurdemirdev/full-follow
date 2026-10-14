import { Link } from "wouter";
import type { PersonCard } from "../../api/types";
import { opportunityPath, PATHS, timelinePath } from "../../app/routes";
import { tl } from "../../lib/format";
import { IDEA_STAGE, INTEREST, INTEREST_TONE, PLATFORM, PROJECT_STAGE, STAGE, STAGE_TONE } from "../../lib/labels";
import { Section } from "../contact";
import { Chip } from "../ui";

function ReferralValueLine({ v }: { v: NonNullable<PersonCard["referral_value"]> }) {
  const parts = [
    `${v.direct} kişi tanıttı${v.network > v.direct ? ` (ağıyla ${v.network})` : ""}`,
    v.opps ? `${v.opps} fırsat` : "henüz fırsat yok",
    v.won ? `${v.won} kazanıldı · ${tl(v.won_value)}` : "",
    v.open_value ? `açıkta ${tl(v.open_value)}` : "",
    v.collected ? `tahsil edilen ${tl(v.collected)}` : "",
  ].filter(Boolean);
  return <p className="m-0 text-base-sm text-text-primary"><span className="text-text-secondary">Referans değeri: </span>{parts.join(" · ")}</p>;
}

/** What the old person card had beyond the board: referral network, deals and projects, marketing links, the free note, the timeline */
export function PersonExtras({ card }: { card: PersonCard }) {
  const p = card.row;
  return (
    <>
      <div className="ppl-panel">
        <Section title="Referans ağı">
          <span className="text-base-sm text-text-secondary">
            {card.referrer ? <Link href={`${PATHS.people}/${card.referrer.id}`}>{card.referrer.name} tanıttı</Link> : "Doğrudan bulundu"}
          </span>
          {card.referrals.length ? (
            <div className="ml-1 flex flex-col gap-2 border-l-2 border-border-default py-1 pl-6">
              {card.referrals.map((r) => (
                <Link key={r.id} href={`${PATHS.people}/${r.id}`} className="flex flex-wrap items-baseline gap-2 text-base-sm text-text-neutral-chip">
                  <span className="text-text-muted">tanıttı ·</span> {r.name}
                  {r.company_name ? <span className="text-text-muted">{r.company_name}</span> : null}
                  {r.opps ? <span className="text-text-secondary">· {r.opps} fırsat{r.won ? `, ${r.won} kazanıldı` : ""}</span> : null}
                  {r.network ? <span className="text-text-muted">· +{r.network} kişi</span> : null}
                </Link>
              ))}
            </div>
          ) : null}
          {card.referral_value ? <ReferralValueLine v={card.referral_value} /> : null}
        </Section>
      </div>

      {card.opportunities.length + card.projects.length + card.drafts.length ? (
        <div className="ppl-panel">
          <Section title="Satış ve projeler">
            {card.drafts.length ? <Link href={PATHS.drafts} className="text-base-sm">{card.drafts.length} taslak onay bekliyor</Link> : null}
            {card.opportunities.map((o) => (
              <Link key={`o${o.id}`} href={opportunityPath(o.id)} className="flex items-center gap-3 text-text-primary hover:text-text-primary">
                <span className="min-w-0 flex-grow truncate text-base">{o.title}</span>
                {o.estimated_value ? <span className="font-mono text-base-sm text-text-secondary">{tl(o.estimated_value)}</span> : null}
                <Chip tone={STAGE_TONE[o.stage]}>{STAGE[o.stage]}</Chip>
              </Link>
            ))}
            {card.projects.map((x) => (
              <Link key={`r${x.id}`} href={timelinePath("project", x.id)} className="flex items-center gap-3 text-text-primary hover:text-text-primary">
                <span className="min-w-0 flex-grow truncate text-base">{x.name}</span>
                <Chip tone="success">{PROJECT_STAGE[x.stage]}</Chip>
              </Link>
            ))}
          </Section>
        </div>
      ) : null}

      {card.post || card.ideas.length ? (
        <div className="ppl-panel">
          <Section title="Pazarlama">
            {card.post ? (
              <Link href={`${PATHS.posts}/${card.post.id}`} className="text-base-sm">
                <span className="text-text-muted">Kaynak paylaşım · </span>{PLATFORM[card.post.platform]} · {card.post.title}
              </Link>
            ) : null}
            {card.ideas.map((x) => (
              <Link key={x.id} href={`${PATHS.ideas}/${x.idea_id}`} className="flex flex-wrap items-center gap-2 text-base-sm text-text-neutral-chip">
                <span className="text-text-muted">Fikir ·</span> {x.idea_title}
                <span className="text-text-muted">({IDEA_STAGE[x.idea_stage]})</span>
                <Chip tone={INTEREST_TONE[x.interest]}>{INTEREST[x.interest]}</Chip>
              </Link>
            ))}
          </Section>
        </div>
      ) : null}

      {p.notes ? <p className="ppl-panel m-0 whitespace-pre-line text-base-sm leading-normal text-text-primary">{p.notes}</p> : null}
      <Link href={timelinePath("person", p.id)} className="text-base-sm">Tüm zaman çizelgesi</Link>
    </>
  );
}
