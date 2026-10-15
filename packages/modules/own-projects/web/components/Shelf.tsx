import type { OwnProject } from "@kit/api/types";
import { OWN_STATUS } from "../labels";
import { m } from "../messages";

/** "Rafta": left and finished projects, each can be taken off the shelf */
export function Shelf({ rows, onRevive }: { rows: OwnProject[]; onRevive: (p: OwnProject) => void }) {
  if (!rows.length) return null;
  return (
    <section aria-label={m.shelf.title} className="opr-shelf">
      <div className="opr-shelf-head">
        <h2>{m.shelf.title}</h2>
        <span>{m.shelf.hint}</span>
      </div>
      {rows.map((p) => (
        <div key={p.id} className="opr-shelf-row" data-record={`own_project-${p.id}`}>
          <span className="opr-shelf-name">{p.name}</span>
          <span className="opr-chip bg-chip-neutral-bg text-text-secondary" data-size="sm">{OWN_STATUS[p.status]}</span>
          <span className="opr-shelf-note">{p.sellable_note || p.description}</span>
          <button type="button" className="opr-revive" onClick={() => onRevive(p)}>{m.shelf.revive}</button>
        </div>
      ))}
    </section>
  );
}
