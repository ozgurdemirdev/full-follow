import { usePaged } from "@kit/api/paged";
import type { Draft } from "@kit/api/types";
import { LoadMore } from "@kit/components/LoadMore";
import { CHANNEL } from "@kit/lib/labels";
import { draftsOf, historyAge, HISTORY_PAGE } from "../drafts";
import { Avatar } from "@kit/components/ui";
import { m } from "../messages";

/** Sent and rejected drafts, newest first; the server pages them as the end of the list scrolls into view */
export function DraftHistory({ status }: { status: "gonderildi" | "reddedildi" }) {
  const rejected = status === "reddedildi";
  const list = usePaged<Draft>(draftsOf(status), HISTORY_PAGE);
  const rows = list.rows;
  return (
    <section className="drf-hist">
      <div className="drf-list">
        {rows.map((d) => (
          <div key={d.id} className="drf-hrow">
            <Avatar name={d.to_name} id={d.person_id ?? undefined} size="list" />
            <div className="drf-hbody">
              <span className="drf-hhead">
                <span className="font-medium">{d.to_name}</span>
                <span className="text-text-muted">{CHANNEL[d.channel] ?? d.channel} · {historyAge(d.updated_at)}</span>
              </span>
              <span className="drf-htext">{d.body}</span>
              {rejected && d.reject_note ? <span className="drf-hreason">{m.history.reason(d.reject_note)}</span> : null}
            </div>
            <span className="drf-hstatus" data-rejected={rejected}>{rejected ? m.history.rejected : m.history.sent}</span>
          </div>
        ))}
      </div>
      <LoadMore hasMore={list.hasMore} loaded={rows.length} onMore={list.loadMore} />
      {list.hasMore ? <button type="button" className="drf-more" onClick={list.loadMore}>{m.history.more}</button> : null}
      {rows.length === 0 && !list.pending ? <p className="drf-empty">{m.history.empty}</p> : null}
    </section>
  );
}
