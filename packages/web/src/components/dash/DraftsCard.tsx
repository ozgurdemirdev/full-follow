import type { Draft, List } from "../../api/types";
import { PATHS } from "../../app/routes";
import { openSheet } from "../../app/ui";
import { CHANNEL } from "../../lib/labels";
import { SHOWN } from "../../lib/dashboard";
import { companyOf } from "../../lib/drafts";
import { initials } from "../../lib/format";
import { BoardIcon } from "../boardIcons";
import { useDraftEdit } from "../drafts/useDraftEdit";
import { Card } from "../ui";
import { useExpand } from "../ExpandOverlay";
import { DashOverlay, type ExRow } from "./DashOverlay";

/** One draft waiting for approval: approve and send, or edit the text in place */
function DraftItem({ d }: { d: Draft }) {
  const { editing, setEditing, text, setText, busy, save, send } = useDraftEdit(d, "Temas olarak kaydedildi");

  return (
    <article className="flex flex-col gap-5 rounded-inner-lg border border-border-subtle bg-surface-2 p-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-base font-medium">{d.to_name}</span>
        {companyOf(d) ? <span className="text-sm text-text-secondary">{companyOf(d)}</span> : null}
        <span className="flex-grow" />
        {d.followup_step ? <span className="dash-chip is-lg bg-claude-bg text-claude-soft">{d.followup_step}. takip</span> : null}
        <span className="dash-chip is-lg bg-chip-neutral-bg text-text-neutral-chip">{CHANNEL[d.channel] ?? d.channel}</span>
      </div>
      {editing ? (
        <textarea className="inp min-h-textarea-lg" aria-label="Taslak metni" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      ) : (
        <p className="m-0 whitespace-pre-line text-base leading-relaxed text-text-body">{d.body}</p>
      )}
      {d.reason ? <p className="m-0 text-sm text-text-secondary"><span className="text-claude-soft">Neden: </span>{d.reason}</p> : null}
      <div className="mt-auto flex flex-wrap gap-3">
        <button type="button" className="dash-btn is-primary" disabled={busy} onClick={() => void send()}>
          <BoardIcon name="check" className="size-icon-chip" stroke={2} />
          Onayla, gönderdim
        </button>
        <button type="button" className="dash-btn" disabled={busy} onClick={editing ? () => void save() : () => setEditing(true)}>{editing ? "Kaydet" : "Düzenle"}</button>
      </div>
    </article>
  );
}

/** "Onay bekleyen taslaklar": the first drafts of the approval queue */
export function DraftsCard({ list }: { list: List<Draft> }) {
  const ex = useExpand();
  const rows: ExRow[] = list.rows.map((d) => ({
    key: d.id, lead: initials(d.to_name), title: d.to_name, sub: `${CHANNEL[d.channel] ?? d.channel} · ${d.body}`,
    tag: d.followup_step ? `${d.followup_step}. takip` : "Yeni", dot: d.followup_step ? "bg-claude" : "bg-entity-later", href: PATHS.drafts,
  }));
  const fromSequence = list.rows.filter((d) => d.followup_step).length;

  return (
    <>
      <Card title="Onay bekleyen taslaklar" count={`${list.total} taslak`} onExpand={(r) => ex.show("drafts", r)} className="dash-gap-7 dash-nowrap-title rise"
        actions={<button type="button" className="dash-btn is-ghost" onClick={() => openSheet("draft")}>Taslak yaz</button>}>
        {list.rows.length === 0 ? <p className="m-0 text-base-sm text-text-muted">Onay bekleyen taslak yok.</p> : null}
        <div className="flex flex-col gap-6">
          {list.rows.slice(0, SHOWN.drafts).map((d) => <DraftItem key={d.id} d={d} />)}
        </div>
      </Card>
      <DashOverlay open={ex.key !== null} from={ex.from} onClose={ex.hide}
        spec={{ title: "Onay bekleyen taslaklar", sub: "Claude hazırladı · onaylayınca temas olarak kaydedilir", page: "Taslaklar", href: PATHS.drafts, foot: `${fromSequence} taslak takip dizisinden geldi`, rows }} />
    </>
  );
}
