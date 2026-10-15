import { useMemo, useState } from "react";
import { run } from "@kit/api/actions";
import { useQuery } from "@kit/api/store";
import type { List, Touch } from "@kit/api/types";
import { openSheet } from "@kit/app/ui";
import { LOOSE_LIMIT } from "../constants";
import { m } from "../messages";
import { groupLoose, namedAddresses } from "../stream";
import { ago } from "@kit/lib/format";
import { BoardIcon } from "@kit/components/boardIcons";

const MATCH_TYPE = m.looseMatchTypes;

/** Moves the touches that have a suggested match to it: those of one address, or every suggestion at once */
const adopt = (contact?: string) => void run("post", "/touches/adopt-suggested", contact ? { contact } : {}).catch(() => {});

/**
 * Touches written to an address only (info@, @account). Opening a person or company with that address
 * links them on its own; the ones whose address belongs to a person or company that exists carry a suggestion that applies in one click.
 */
export function LooseTouches() {
  const loose = useQuery<List<Touch>>(`/touches?loose=true&limit=${LOOSE_LIMIT}`);
  const groups = useMemo(() => groupLoose(loose.data?.rows ?? []), [loose.data]);
  const [open, setOpen] = useState(false);
  if (!groups.length) return null;
  const suggested = groups.filter((g) => g.match).length;
  return (
    <section aria-label={m.loose.label} className="co-loose">
      <span className="co-loose-icon"><BoardIcon name="mail" /></span>
      <div className="co-loose-text">
        <span className="text-md">{m.loose.title(loose.data?.total ?? groups.length)}</span>
        <span className="text-base-sm text-text-secondary">{m.loose.line(namedAddresses(groups), suggested)}</span>
      </div>
      {suggested ? <button type="button" className="co-btn" onClick={() => adopt()}>{m.loose.applyAll}</button> : null}
      <button type="button" className="co-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? m.loose.hide : m.loose.look}</button>
      {open ? (
        <div className="co-loose-list">
          {groups.map((g) => (
            <div key={g.contact} className="co-loose-row">
              <span className="flex min-w-0 flex-grow flex-col">
                <span className="truncate text-base">{g.contact}</span>
                <span className="text-sm text-text-muted">{m.loose.count(g.count, ago(g.last), g.replied)}</span>
                {g.match ? <span className="text-sm text-claude-soft">{m.loose.suggestion(g.match.name, MATCH_TYPE[g.match.type])}</span> : null}
              </span>
              {g.match ? <button type="button" className="ppl-small is-accent" onClick={() => adopt(g.contact)}>{m.loose.applyOne}</button> : null}
              <button type="button" className="ppl-small" onClick={() => openSheet("person", { contact: g.contact })}>{m.loose.makePerson}</button>
              <button type="button" className="ppl-small" onClick={() => openSheet("company", { contact: g.contact })}>{m.loose.makeCompany}</button>
              <button type="button" className="ppl-small is-soft" onClick={() => openSheet("touch", { contact: g.contact })}>{m.loose.touch}</button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
