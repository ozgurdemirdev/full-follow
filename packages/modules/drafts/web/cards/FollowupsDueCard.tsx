import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { run } from "@kit/api/actions";
import type { FollowupDue, List, Today } from "@kit/api/types";
import { useLinkTo } from "@kit/app/modules/registry";
import { SHOWN } from "@kit/lib/dashboard";
import { initials } from "@kit/lib/format";
import { CHANNEL_DOT } from "../labels";
import { m } from "../messages";
import { channelName } from "@kit/lib/network";
import { Card } from "@kit/components/ui";

const ROW_CLASS = "dash-row flex items-center gap-5 border-t border-border-subtle py-4 text-text-primary hover:text-text-primary";

/** A row that opens the person's page, or reads as plain text when no visible module has one */
function PersonRow({ id, children }: { id: number | null; children: ReactNode }) {
  const href = useLinkTo()("person", id ?? 0);
  return id && href ? <Link href={href} className={ROW_CLASS}>{children}</Link> : <div className={ROW_CLASS}>{children}</div>;
}

/** Follow-up messages due in the marketing sequence, and the button that makes their drafts */
function FollowupsDueBody({ list }: { list: List<FollowupDue> }) {
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try {
      await run("post", "/followups/run", undefined, { ok: m.followups.madeOk });
    } catch {
      /* the notice is shown by run() */
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={m.followups.title} className="dash-gap-4 dash-head-pad rise"
      actions={<button type="button" className="dash-btn is-claude is-small" disabled={busy} onClick={make}>{m.followups.makeNow}</button>}>
      {list.rows.slice(0, SHOWN.followups).map((f) => (
        <PersonRow key={`${f.person_id}-${f.contact}`} id={f.person_id}>
          <span className="dash-av size-avatar-list text-sm">{initials(f.name)}</span>
          <span className="flex min-w-0 flex-grow flex-col">
            <span className="truncate text-base">{f.name}{f.company_name ? <span className="text-text-secondary"> · {f.company_name}</span> : null}</span>
            <span className="flex items-center gap-2 text-sm text-warning"><span className={`dash-dot ${CHANNEL_DOT[f.channel] ?? "bg-entity-neutral"}`} />{m.followups.noReply(f.days)} · {channelName(f.channel)}</span>
          </span>
          <span className="dash-chip is-lg bg-claude-bg text-claude-soft">{m.followup(f.step)}</span>
        </PersonRow>
      ))}
    </Card>
  );
}

export const FollowupsDueCard = ({ today }: { today: Today }) => <FollowupsDueBody list={today.followups!} />;
