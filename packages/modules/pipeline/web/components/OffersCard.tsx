import { remove, run } from "@kit/api/actions";
import { openSheet } from "@kit/app/ui";
import type { FileRow, Offer } from "@kit/api/types";
import { fmtDay, tl } from "@kit/lib/format";
import { fileHref } from "@kit/components/FilesCard";
import { Card, Chip, Empty } from "@kit/components/ui";

/** Offer versions of an opportunity: newest first, one can be accepted (its amount becomes the opportunity value) */
export function OffersCard({ opportunityId, offers, files }: { opportunityId: number; offers: Offer[]; files: FileRow[] }) {
  const accept = (o: Offer, accepted: boolean) =>
    void run("patch", `/offers/${o.id}`, { accepted }, { ok: accepted ? `v${o.version} kabul edildi` : "Kabul geri alındı" }).catch(() => {});
  return (
    <Card title="Teklifler" className="opp-side rise" actions={<button type="button" className="btn btn-sec btn-sm" onClick={() => openSheet("offer", { opportunity_id: opportunityId })}>Yeni teklif</button>}>
      {!offers.length ? <Empty>Henüz teklif yok. Her revizyon yeni bir sürüm olarak kaydedilir.</Empty> : null}
      {offers.map((o) => {
        const file = files.find((f) => f.id === o.file_id);
        return (
          <div key={o.id} className="inset flex flex-col gap-3 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-base font-semibold">v{o.version}</span>
              <span className="font-mono text-base">{tl(o.amount)}</span>
              {o.accepted_at ? <Chip tone="success">Kabul · {fmtDay(o.accepted_at)}</Chip> : null}
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
                ? <button type="button" className="btn btn-sec btn-sm" onClick={() => accept(o, false)}>Kabulü geri al</button>
                : <button type="button" className="btn btn-pri btn-sm" onClick={() => accept(o, true)}>Kabul et</button>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openSheet("offer", { opportunity_id: opportunityId, edit: o.id })}>Düzenle</button>
              <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => void remove(`/offers/${o.id}`, `v${o.version} teklifi`).catch(() => {})}>Sil</button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
