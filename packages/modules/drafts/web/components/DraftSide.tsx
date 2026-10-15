import { useMemo, useRef } from "react";
import { Link } from "wouter";
import { cardKey, companyCardKey } from "@kit/api/keys";
import { useQuery } from "@kit/api/store";
import type { CompanyCard, Draft, Person, PersonCard } from "@kit/api/types";
import { useLinkTo } from "@kit/app/modules/registry";
import { byRecent, firstName, shortAge, SIDE_TOUCHES, touchLine } from "../drafts";
import { m } from "../messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** Arrow of the record link, as on the board */
const LINK_ARROW = "M7 17 17 7M9 7h8v8";

/** Where "Neden şimdi" leads: the opportunity in the funnel, else the person's card, else the company's */
function recordLink(d: Draft, person: Person | undefined, linkTo: (type: string, id: number) => string | null): { href: string; name: string } | null {
  const opportunity = d.opportunity_id ? linkTo("opportunity", d.opportunity_id) : null;
  if (opportunity) return { href: opportunity, name: m.side.openFunnel };
  const personPage = d.person_id ? linkTo("person", d.person_id) : null;
  if (personPage) return { href: personPage, name: m.side.personCard(firstName(person?.name ?? d.to_name)) };
  const companyPage = d.company_id ? linkTo("company", d.company_id) : null;
  if (companyPage) return { href: companyPage, name: m.side.companyCard(d.to_name) };
  return null;
}

/** Last touches with the person (or company) of the draft on top; the card is cached and shared with the person overlay */
function RecentTouches({ d }: { d: Draft }) {
  const person = useQuery<PersonCard>(d.person_id ? cardKey(d.person_id) : null);
  const company = useQuery<CompanyCard>(!d.person_id && d.company_id ? companyCardKey(d.company_id) : null);
  const touches = (person.data ?? company.data)?.touches.rows;
  const latest = useMemo(() => (touches ? [...touches].sort(byRecent).slice(0, SIDE_TOUCHES) : []), [touches]);
  if (!latest.length) return null;
  return (
    <section className="drf-sec is-tight">
      <span className="drf-sec-label">{m.side.recent(firstName(d.to_name))}</span>
      {latest.map((t) => (
        <div key={t.id} className="drf-touch">
          <span className="drf-touch-at">{shortAge(t.happened_at)}</span>
          <span className="drf-touch-text">{touchLine(t)}</span>
        </div>
      ))}
    </section>
  );
}

/** Learned rules (G12); the ones that appear while the screen is open read in the Claude colour */
function Rules({ rules }: { rules: string[] }) {
  const seen = useRef<Set<string> | null>(null);
  seen.current ??= new Set(rules);
  return (
    <section className="drf-sec">
      <div className="drf-rules-head">
        <span className="flex-grow text-base">{m.side.learned}</span>
        <span className="drf-sec-label">{m.side.fromRejects}</span>
      </div>
      {rules.map((r) => (
        <div key={r} className="drf-rule">
          <span className="drf-rule-dot" data-new={!seen.current?.has(r)} />
          {r}
        </div>
      ))}
    </section>
  );
}

/** Context of the draft on top: why now, the latest touches, what Claude learned from rejects */
export function DraftSide({ d, person, rules }: { d: Draft; person?: Person; rules: string[] }) {
  const linkTo = useLinkTo();
  const link = recordLink(d, person, linkTo);
  return (
    <aside className="drf-side" aria-label={m.side.label}>
      {d.reason || link ? (
        <section className="drf-sec">
          <span className="drf-sec-label">{m.side.whyNow}</span>
          {d.reason ? <p className="drf-why">{d.reason}</p> : null}
          {link ? (
            <Link href={link.href} className="drf-link">
              {link.name}
              <svg className="size-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={STROKE.medium} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={LINK_ARROW} /></svg>
            </Link>
          ) : null}
        </section>
      ) : null}
      <RecentTouches d={d} />
      {rules.length ? <Rules rules={rules} /> : null}
    </aside>
  );
}
