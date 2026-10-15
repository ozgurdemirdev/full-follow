import { useMemo } from "react";
import { useOpps } from "@kit/api/keys";
import type { Opportunity, Person, Post } from "@kit/api/types";
import { Section } from "@kit/components/contact";
import { RecordLink } from "@kit/components/RecordLink";
import { Chip } from "@kit/components/ui";
import { lira } from "@kit/lib/format";
import { STAGE, STAGE_TONE } from "@kit/lib/labels";

/** Open and closed opportunities of the given people, most valuable first */
function oppsOf(opps: Opportunity[], people: Person[]): Opportunity[] {
  const ids = new Set(people.map((p) => p.id));
  return opps.filter((o) => ids.has(o.person_id)).sort((a, b) => (b.estimated_value ?? 0) - (a.estimated_value ?? 0));
}

/** The opportunities a post's people opened, on the post overlay (the `post.overlay.side` slot of the posts screen) */
export default function PostOpps({ post: p, people }: { post: Post; people: Person[] }) {
  const opps = useOpps(people.length > 0);
  const list = useMemo(() => oppsOf(opps.rows, people), [opps.rows, people]);
  return (
    <div className="ppl-panel">
      <Section title={`Fırsatlar · ${p.opp_count}`} right={p.won ? <Chip tone="success">{p.won} kazanıldı · {lira(p.won_value)}</Chip> : undefined}>
        {list.length ? list.map((o) => (
          <RecordLink key={o.id} type="opportunity" id={o.id} className="posts-link-row">
            <span className="min-w-0 flex-grow truncate text-base">{o.title}</span>
            {o.estimated_value ? <span className="font-mono text-base-sm text-text-secondary">{lira(o.estimated_value)}</span> : null}
            <Chip tone={STAGE_TONE[o.stage]}>{STAGE[o.stage]}</Chip>
          </RecordLink>
        )) : <span className="text-base-sm text-text-muted">{p.opp_count ? "Yükleniyor" : "Henüz fırsat yok"}</span>}
      </Section>
    </div>
  );
}
