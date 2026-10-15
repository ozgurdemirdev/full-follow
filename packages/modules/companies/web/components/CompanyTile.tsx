import { memo } from "react";
import { SEGMENT_LABEL, siteLabel, TILE_AVATARS, type CompanyView } from "../companies";
import { COLD_DAYS, lastText } from "@kit/lib/people";
import { initials, lira } from "@kit/lib/format";
import { BoardIcon } from "@kit/components/boardIcons";
import { avatarPair } from "@kit/components/ui";

import { m } from "../messages";
import { MoneyBar } from "./MoneyBar";
import { stroke as STROKE } from "@kit/styles/tokens.json";

/** One tile of the list: name, money bar, people, last touch and the hint line of Claude */
export const CompanyTile = memo(function CompanyTile({ v, max, onOpen }: { v: CompanyView; max: number; onOpen: (id: number, from: HTMLElement) => void }) {
  const { c, money, people } = v;
  const seg = SEGMENT_LABEL[v.segment];
  const sub = [c.sector_path, c.city].filter(Boolean).join(m.sep) || (c.website ? siteLabel(c.website) : m.tile.noInfo);
  const note = money.won > 0 ? (v.since ? m.tile.since(seg, v.since) : seg) : v.total > 0 ? m.tile.potential(lira(v.total)) : seg;
  return (
    <article className="co-tile" data-record={`company-${c.id}`}>
      <button type="button" className="co-open" aria-label={m.tile.open(c.name)} onClick={(e) => onOpen(c.id, e.currentTarget.closest("article") ?? e.currentTarget)}>
        <span className={`co-mono ${avatarPair(c.name, c.id)}`} aria-hidden="true">{initials(c.name)}</span>
        <span className="flex min-w-0 flex-grow flex-col">
          <span className="co-name">{c.name}</span>
          <span className="co-sub">{sub}</span>
        </span>
        <span className="co-go"><BoardIcon name="arrowUpRight" className="size-icon-xs" stroke={STROKE.bold} /></span>
      </button>

      <div className="co-money-block">
        <div className="co-money-row">
          <span className="co-won">{lira(money.won)}</span>
          <span className="co-note">{note}</span>
        </div>
        <MoneyBar money={money} max={max} />
        <div className="co-legend">
          <span data-k="won"><i />{m.tile.won}</span>
          {money.due > 0 ? <span data-k="due"><i />{m.tile.waiting(lira(money.due))}</span> : null}
          {money.open > 0 ? <span data-k="open"><i />{m.tile.openAmount(lira(money.open))}</span> : null}
        </div>
      </div>

      <div className="co-people">
        <span className="co-stack">
          {people.slice(0, TILE_AVATARS).map((p) => (
            <span key={p.id} title={p.name} className={`co-pa ${avatarPair(p.name, p.id)} ${p.last_touch_at ? "" : "is-off"}`}>{initials(p.name)}</span>
          ))}
        </span>
        <span className="co-people-text">{people.length === 1 ? people[0].name : people.length ? m.tile.people(people.length) : m.tile.noPeople}</span>
        <span className={`co-last ${v.days !== null && v.days > COLD_DAYS ? "is-cold" : ""}`}>{lastText(v.days)}</span>
      </div>

      {v.hint ? <div className="co-hint"><i /><span>{v.hint}</span></div> : null}
    </article>
  );
});
