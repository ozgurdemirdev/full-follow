import { useState } from "react";
import type { Draft } from "@kit/api/types";
import { CHANNEL } from "@kit/lib/labels";
import { historyAge, HISTORY_PAGE } from "../drafts";
import { Avatar } from "@kit/components/ui";

/** Sent and rejected drafts, newest change first */
export function DraftHistory({ rows, rejected }: { rows: Draft[]; rejected: boolean }) {
  const [shown, setShown] = useState(HISTORY_PAGE);
  return (
    <section className="drf-hist">
      <div className="drf-list">
        {rows.slice(0, shown).map((d) => (
          <div key={d.id} className="drf-hrow">
            <Avatar name={d.to_name} id={d.person_id ?? undefined} size="list" />
            <div className="drf-hbody">
              <span className="drf-hhead">
                <span className="font-medium">{d.to_name}</span>
                <span className="text-text-muted">{CHANNEL[d.channel] ?? d.channel} · {historyAge(d.updated_at)}</span>
              </span>
              <span className="drf-htext">{d.body}</span>
              {rejected && d.reject_note ? <span className="drf-hreason">Ret nedeni: {d.reject_note}</span> : null}
            </div>
            <span className="drf-hstatus" data-rejected={rejected}>{rejected ? "Reddedildi" : "Gönderildi · temas kaydedildi"}</span>
          </div>
        ))}
      </div>
      {rows.length > shown ? <button type="button" className="drf-more" onClick={() => setShown((n) => n + HISTORY_PAGE)}>Daha fazla</button> : null}
      {rows.length === 0 ? <p className="drf-empty">Burada şu an taslak yok.</p> : null}
    </section>
  );
}
