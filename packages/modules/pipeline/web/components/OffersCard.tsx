import { remove, run } from "@kit/api/actions";
import { openSheet } from "@kit/app/ui";
import type { FileRow, Offer } from "@kit/api/types";
import { fmtDay, tl } from "@kit/lib/format";
import { fileHref } from "@kit/components/FilesCard";
import { Card, Chip, Empty } from "@kit/components/ui";
import { m } from "../messages";

/** Offer versions of an opportunity: newest first, one can be accepted (its amount becomes the opportunity value) */
export function OffersCard({ opportunityId, offers, files }: { opportunityId: number; offers: Offer[]; files: FileRow[] }) {
  const accept = (o: Offer, accepted: boolean) =>
    void run("patch", `/offers/${o.id}`, { accepted }, { ok: accepted ? m.offers.accepted(o.version) : m.offers.acceptUndone }).catch(() => {});
  return (
    <Card title={m.offers.title} className="opp-side rise" actions={<button type="button" className="btn btn-sec btn-sm" onClick={() => openSheet("offer", { opportunity_id: opportunityId })}>{m.offers.newOffer}</button>}>
      {!offers.length ? <Empty>{m.offers.none}</Empty> : null}
      {offers.map((o) => {
        const file = files.find((f) => f.id === o.file_id);
        return (
          <div key={o.id} className="inset flex flex-col gap-3 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-semibold">{m.offers.version(o.version)}</span>
              <span className="font-mono text-base">{tl(o.amount)}</span>
              {o.accepted_at ? <Chip tone="success">{m.offers.acceptedOn(fmtDay(o.accepted_at))}</Chip> : null}
              <span className="flex-grow" />
              <span className="text-sm text-text-secondary">{fmtDay(o.offered_at)}</span>
            </div>
            {o.items.length ? (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-base-sm text-text-secondary">
                {o.items.map((i, k) => (
                  <li key={k} className="flex gap-3"><span className="min-w-0 flex-grow truncate">{i.qty > 1 ? `${i.qty} × ` : ""}{i.label}</span><span className="font-mono">{tl(i.line)}</span></li>
                ))}
              </ul>
            ) : null}
            {o.note ? <p className="m-0 whitespace-pre-line text-base-sm">{o.note}</p> : null}
            {file ? <a href={fileHref(file.id)} target="_blank" rel="noreferrer" className="truncate text-base-sm">{file.name}</a> : null}
            <div className="flex flex-wrap gap-2">
              {o.accepted_at
                ? <button type="button" className="btn btn-sec btn-sm" onClick={() => accept(o, false)}>{m.offers.undoAccept}</button>
                : <button type="button" className="btn btn-pri btn-sm" onClick={() => accept(o, true)}>{m.offers.accept}</button>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("offer", { opportunity_id: opportunityId, edit: o.id })}>{m.shared.edit}</button>
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(`/offers/${o.id}`, m.offers.deleteNoun(o.version)).catch(() => {})}>{m.shared.delete}</button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
