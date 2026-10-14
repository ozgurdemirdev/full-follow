import type { OwnRow } from "../../api/types";
import { OWN_STATUS } from "../../lib/labels";

/** "Rafta": left and finished projects, each can be taken off the shelf */
export function Shelf({ rows, onRevive }: { rows: OwnRow[]; onRevive: (p: OwnRow) => void }) {
  if (!rows.length) return null;
  return (
    <section aria-label="Rafta" className="opr-shelf">
      <div className="opr-shelf-head">
        <h2>Rafta</h2>
        <span>Bırakılan ve tamamlanan projeler</span>
      </div>
      {rows.map((p) => (
        <div key={p.id} className="opr-shelf-row" data-record={`own_project-${p.id}`}>
          <span className="opr-shelf-name">{p.name}</span>
          <span className="opr-chip bg-chip-neutral-bg text-text-secondary" data-size="sm">{OWN_STATUS[p.status]}</span>
          <span className="opr-shelf-note">{p.sellable_note || p.description}</span>
          <button type="button" className="opr-revive" onClick={() => onRevive(p)}>Raftan indir</button>
        </div>
      ))}
    </section>
  );
}
