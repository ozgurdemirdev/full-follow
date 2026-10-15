// The dashboard card the board leaves out but the dashboard keeps: people and opportunities whose follow-up date has come
import { useMemo } from "react";
import { Link } from "wouter";
import { useModules } from "../../api/modules";
import type { Today } from "../../api/types";
import { opportunityPath, PATHS } from "../../app/routes";
import { SHOWN } from "../../lib/dashboard";
import { followNote, initials } from "../../lib/format";
import { STAGE } from "../../lib/labels";
import { useRecordHref } from "../../lib/useRecordHref";
import { Card } from "../ui";
import { MoreLink } from "./MoreLink";

interface FollowItem {
  key: string;
  name: string;
  org: string | null;
  note: ReturnType<typeof followNote>;
  stage?: string;
  href: string;
}

/** People and opportunities whose follow-up date has come (the header counts them as "takip") */
export function FollowUpsCard({ data }: { data: Today }) {
  const { has } = useModules();
  const recordHref = useRecordHref();
  const items = useMemo(() => {
    const seen = new Set<number>();
    const out: FollowItem[] = [];
    for (const o of data.follow_ups?.opportunities?.rows ?? []) {
      seen.add(o.person_id);
      out.push({ key: `o${o.id}`, name: o.person_name, org: o.title, note: followNote(o.next_follow_up_at), stage: STAGE[o.stage], href: opportunityPath(o.id) });
    }
    for (const p of data.follow_ups?.people?.rows ?? []) {
      if (seen.has(p.id)) continue;
      out.push({ key: `p${p.id}`, name: p.name, org: p.company_name, note: followNote(p.next_follow_up_at), href: recordHref("person", p.id) });
    }
    return out;
  }, [data, recordHref]);

  return (
    <Card title="Takibi gelenler" className="dash-gap-4 dash-head-pad rise" actions={has("people") ? <MoreLink href={PATHS.people}>Hepsi</MoreLink> : undefined}>
      {items.length === 0 ? <p className="m-0 text-base-sm text-text-muted">Bugün takibi gelen kimse yok.</p> : null}
      {items.slice(0, SHOWN.followups).map((it) => (
        <Link key={it.key} href={it.href} className="dash-row flex items-center gap-5 border-t border-border-subtle py-4 text-text-primary hover:text-text-primary">
          <span className="dash-av size-avatar-list text-sm">{initials(it.name)}</span>
          <span className="flex min-w-0 flex-grow flex-col">
            <span className="truncate text-base">{it.name}{it.org ? <span className="text-text-secondary"> · {it.org}</span> : null}</span>
            {it.note ? <span className={`text-sm ${it.note.late ? "text-warning" : "text-text-secondary"}`}>{it.note.text}</span> : null}
          </span>
          {it.stage ? <span className="dash-chip is-lg bg-chip-opportunity-bg text-chip-opportunity-fg">{it.stage}</span> : null}
        </Link>
      ))}
    </Card>
  );
}
