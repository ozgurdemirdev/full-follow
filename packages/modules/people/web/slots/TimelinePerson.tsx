import { Link } from "wouter";
import type { Detail, Opportunity, Person, Touch } from "@kit/api/types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { openSheet } from "@kit/app/ui";
import { Avatar, Chip, Tags, Who } from "@kit/components/ui";
import { useAskClaude } from "@kit/lib/askClaude";
import { draftRequest } from "@kit/lib/people";
import { useTasksOn } from "@kit/lib/taskAccess";
import { useRecordHref } from "@kit/lib/useRecordHref";
import { STAGE, STAGE_TONE } from "@kit/lib/labels";
import { m as kit } from "@kit/messages";
import { m } from "../messages";

/** What the timeline gives a card of its side panel (the `timeline.aside` slot) */
interface AsideProps {
  type: string;
  detail: Detail<any>;
  touches: Touch[];
}

function Referrals({ by, name, referrals }: { by: { id: number; name: string } | null; name: string; referrals: Person[] }) {
  const recordHref = useRecordHref();
  if (!by && !referrals.length) return null;
  return (
    <section className="card rise flex flex-col gap-5 p-8">
      <h2 className="m-0 text-base font-semibold">{m.referralNetwork}</h2>
      <div className="flex flex-col">
        {by ? (
          <Link href={recordHref("person", by.id)} className="flex items-center gap-4 text-base-sm">
            <span className="dot bg-entity-source" />{m.introducedBy(by.name)}
          </Link>
        ) : null}
        <div className="ml-1 flex flex-col gap-3 border-l-2 border-border-subtle py-3 pl-6">
          <span className="text-base font-medium">{name}</span>
          {referrals.map((r) => (
            <Link key={r.id} href={recordHref("person", r.id)} className="text-base-sm text-text-neutral-chip">
              <span className="text-text-muted">{m.timeline.introduced}</span>{r.name}{r.company_name ? `${m.sep}${r.company_name}` : ""}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The person's contact summary, their opportunities and their referral network beside the timeline of a focused person */
export default function TimelinePerson({ type, detail, touches }: AsideProps) {
  const tasksOn = useTasksOn();
  const { asked, ask } = useAskClaude();
  if (type !== "person") return null;
  const p = detail.row as Person;
  const mine = touches.filter((t) => t.person_id === p.id);
  const opps = (detail.related.opportunities as Opportunity[] | undefined) ?? [];
  const referrals = (detail.related.referrals as Person[] | undefined) ?? [];
  const stats = [
    { n: mine.length, l: m.timeline.statTouches },
    { n: mine.filter((t) => t.direction === "gelen").length, l: m.timeline.statReplies },
    { n: mine.filter((t) => t.kind === "gorusme").length, l: m.timeline.statMeetings },
  ];
  return (
    <>
      <section className="card rise flex flex-col gap-6 p-8">
        <div className="flex items-center gap-5">
          <Avatar name={p.name} size="lg" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-md font-semibold">{p.name}</span>
            <span className="text-base-sm text-text-secondary">{[p.company_name, p.email ?? p.phone ?? p.handle].filter(Boolean).join(m.sep)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tags ids={p.tag_ids} />
          {[...new Set(opps.map((o) => o.source_name))].map((s) => <Chip key={s} tone="source">{s}</Chip>)}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {stats.map((s) => (
            <div key={s.l} className="rounded-inner bg-surface-inset px-1 py-4">
              <div className="text-xl font-semibold">{s.n}</div>
              <div className="text-xs text-text-secondary">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-pri" onClick={() => openSheet("touch", { person_id: p.id })}>{m.actions.addTouch}</button>
          {tasksOn ? <button type="button" className="btn btn-sec" disabled={asked(draftRequest(p))} onClick={() => void ask(draftRequest(p))}>{asked(draftRequest(p)) ? m.actions.draftAsked : m.actions.askDraft}</button> : null}
          <button type="button" className="btn btn-sec" onClick={() => openSheet("person", { person_id: p.id })}>{kit.edit}</button>
        </div>
      </section>
      {opps.length ? (
        <section className="card rise flex flex-col gap-3 p-8">
          <h2 className="m-0 text-base font-semibold">{kit.nouns.opportunities}</h2>
          {opps.map((o) => (
            <RecordLink key={o.id} type="opportunity" id={o.id} className="inset flex items-center gap-3 px-5 py-4 text-text-primary hover:text-text-primary">
              <span className="min-w-0 flex-grow truncate text-base">{o.title}</span>
              <Who actor={o.created_by} />
              <Chip tone={STAGE_TONE[o.stage]}>{STAGE[o.stage]}</Chip>
            </RecordLink>
          ))}
        </section>
      ) : null}
      <Referrals by={p.referred_by_id ? { id: p.referred_by_id, name: p.referred_by_name ?? "" } : null} name={p.name} referrals={referrals} />
    </>
  );
}
