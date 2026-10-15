import { run } from "@kit/api/actions";
import type { Post, Today } from "@kit/api/types";
import { MoreLink } from "@kit/components/dash/MoreLink";
import { Card } from "@kit/components/ui";
import { SHOWN } from "@kit/lib/dashboard";
import { PLATFORM, PLATFORM_DOT } from "@kit/lib/labels";
import { refreshNote } from "../marketing";
import { POSTS_PATH } from "../paths";

/** Posts whose refresh date has come */
export function PostsDueCard({ today }: { today: Today }) {
  const refresh = (p: Post) => run("post", `/posts/${p.id}/refresh`, undefined, { ok: "Güncellendi olarak işaretlendi" }).catch(() => {});
  return (
    <Card title="Güncellenecek paylaşımlar" className="dash-gap-4 dash-head-pad rise" actions={<MoreLink href={POSTS_PATH}>Hepsi</MoreLink>}>
      {today.posts_due!.rows.slice(0, SHOWN.posts).map((p) => (
        <div key={p.id} className="flex items-center gap-5 border-t border-border-subtle py-4">
          <span className={`dash-dot ${PLATFORM_DOT[p.platform] ?? "bg-entity-neutral"}`} />
          <div className="flex min-w-0 flex-grow flex-col">
            {p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-base text-text-primary">{p.title}</a> : <span className="truncate text-base">{p.title}</span>}
            <span className="text-sm text-warning">{PLATFORM[p.platform]} · {refreshNote(p)?.text}</span>
          </div>
          <button type="button" className="dash-btn is-small flex-none" onClick={() => refresh(p)}>Güncelledim</button>
        </div>
      ))}
    </Card>
  );
}
