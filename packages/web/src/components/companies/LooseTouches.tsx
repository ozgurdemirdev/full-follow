import { useMemo, useState } from "react";
import { useQuery } from "../../api/store";
import type { List, Touch } from "../../api/types";
import { openSheet } from "../../app/ui";
import { groupLoose, namedAddresses } from "../../lib/companies";
import { ago } from "../../lib/format";
import { BoardIcon } from "../boardIcons";

const MATCH_TYPE = { person: "kişi", company: "firma" } as const;

/**
 * Touches written to an address only (info@, @account). Opening a person or company with that address
 * links them on its own; a suggested match is shown when core provides one.
 */
export function LooseTouches() {
  const loose = useQuery<List<Touch>>("/touches?loose=true&limit=500");
  const groups = useMemo(() => groupLoose(loose.data?.rows ?? []), [loose.data]);
  const [open, setOpen] = useState(false);
  if (!groups.length) return null;
  const suggested = groups.some((g) => g.match);
  return (
    <section aria-label="Firmaya bağlanmamış temaslar" className="co-loose">
      <span className="co-loose-icon"><BoardIcon name="mail" /></span>
      <div className="co-loose-text">
        <span className="text-md">{loose.data?.total ?? groups.length} temas sadece adresle yazılmış</span>
        <span className="text-base-sm text-text-secondary">{namedAddresses(groups)}. {suggested ? "Claude kişi ya da firma önerdi." : "Kişi ya da firma açınca temasları ona bağlanır."}</span>
      </div>
      <button type="button" className="co-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Gizle" : "Adreslere bak"}</button>
      {open ? (
        <div className="co-loose-list">
          {groups.map((g) => (
            <div key={g.contact} className="co-loose-row">
              <span className="flex min-w-0 flex-grow flex-col">
                <span className="truncate text-base">{g.contact}</span>
                <span className="text-sm text-text-muted">{g.count} temas · {ago(g.last)}{g.replied ? " · cevap geldi" : ""}</span>
                {g.match ? <span className="text-sm text-claude-soft">Claude önerisi: {g.match.name} ({MATCH_TYPE[g.match.type]})</span> : null}
              </span>
              <button type="button" className="ppl-small" onClick={() => openSheet("person", { contact: g.contact })}>Kişi yap</button>
              <button type="button" className="ppl-small" onClick={() => openSheet("company", { contact: g.contact })}>Firma yap</button>
              <button type="button" className="ppl-small is-soft" onClick={() => openSheet("touch", { contact: g.contact })}>Temas</button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
