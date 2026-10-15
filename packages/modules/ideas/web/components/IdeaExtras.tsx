import type { Idea } from "@kit/api/types";
import type { IdeaRelated } from "../types";
import { RecordLink } from "@kit/app/modules/RecordLink";
import { ago } from "@kit/lib/format";
import { PLATFORM } from "@kit/lib/labels";
import { channelName } from "@kit/lib/network";
import { m } from "../messages";
import { m as kit } from "@kit/messages";

/** What the board leaves out but the page had: notes, the touches that told this idea, the posts about it (blocks of the board's inner style) */
export function IdeaExtras({ idea, related }: { idea: Idea; related?: IdeaRelated }) {
  const touches = related?.touches ?? [];
  const posts = related?.posts ?? [];
  return (
    <>
      {idea.notes ? (
        <div className="ideas-block">
          <h3>{kit.nouns.notes}</h3>
          <p>{idea.notes}</p>
        </div>
      ) : null}
      {touches.length ? (
        <div className="ideas-block">
          <h3>{m.extras.touches}</h3>
          {touches.map((t) => (
            <p key={t.id}>
              <span className="is-meta">{m.extras.touch(t.person_name ?? "",t.direction === "gelen" ? m.extras.incoming : m.extras.outgoing, channelName(t.channel), ago(t.happened_at))}</span>
              <br />
              {t.summary}
            </p>
          ))}
        </div>
      ) : null}
      {posts.length ? (
        <div className="ideas-block">
          <h3>{m.extras.posts}</h3>
          {posts.map((p) => (
            <RecordLink key={p.id} type="post" id={p.id} className="text-base-sm">{m.extras.post(PLATFORM[p.platform], p.title, p.people_count)}</RecordLink>
          ))}
        </div>
      ) : null}
    </>
  );
}
