import { memo, type KeyboardEvent } from "react";
import type { Person, Post } from "@kit/api/types";
import { lira } from "@kit/lib/format";
import { POST_FORMAT } from "../labels";
import { ageText, peopleLine, TILE_AVATARS } from "../posts";
import { BoardIcon } from "@kit/components/boardIcons";
import { Avatar } from "@kit/components/ui";
import { PlatformPill } from "./PlatformPill";

function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <span className="posts-stat">
      <span className={`posts-stat-n ${tone ?? ""}`}>{n}</span>
      <span className="posts-stat-l">{label}</span>
    </span>
  );
}

const Arrow = () => <span className="posts-flow-arrow"><BoardIcon name="chevronRight" className="size-icon-sm" stroke={2.2} /></span>;

/** One post: platform, age, title, excerpt, people to opportunities to won, avatars and the value; a click opens the post */
export const PostTile = memo(function PostTile({ p, people, onOpen }: { p: Post; people: Person[]; onOpen: (id: number, el: HTMLElement) => void }) {
  const wonTone = p.won ? "posts-won" : "posts-none";
  const key = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(p.id, e.currentTarget);
    }
  };
  return (
    <article
      className="posts-tile"
      data-record={`post-${p.id}`}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={p.title}
      onClick={(e) => onOpen(p.id, e.currentTarget)}
      onKeyDown={key}
    >
      <div className="posts-tile-top">
        <PlatformPill platform={p.platform} />
        <span className="posts-tile-meta">{p.format ? `${POST_FORMAT[p.format]} · ` : ""}{ageText(p)}</span>
      </div>
      <div className="posts-tile-body">
        <span className="posts-tile-title">{p.title}</span>
        {p.body ? <span className="posts-tile-excerpt">{p.body}</span> : null}
      </div>
      <div className="posts-flow">
        <Stat n={p.people_count} label="kişi" />
        <Arrow />
        <Stat n={p.opp_count} label="fırsat" />
        <Arrow />
        <Stat n={p.won} label="kazanıldı" tone={wonTone} />
      </div>
      <div className="posts-foot">
        <span className="posts-stack">
          {people.slice(0, TILE_AVATARS).map((x) => <Avatar key={x.id} name={x.name} id={x.id} size="stack" title={x.name} />)}
        </span>
        <span className="posts-foot-text">{peopleLine(p.people_count)}</span>
        <span className={`posts-foot-value ${wonTone}`}>{p.won_value ? lira(p.won_value) : "henüz iş yok"}</span>
      </div>
    </article>
  );
});
