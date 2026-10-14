import { useState } from "react";
import { useLinks } from "../LinksCard";
import { BoardIcon } from "../boardIcons";

/** "Linkler" panel of the project overlay: link rows, and a dashed "Link ekle" that opens the add form */
export function OwnLinks({ id }: { id: number }) {
  const { rows, label, setLabel, url, setUrl, busy, ready, add, del } = useLinks("own_project", id);
  const [adding, setAdding] = useState(false);
  const submit = async () => {
    if (!ready) return;
    await add();
    setAdding(false);
  };
  return (
    <div className="opr-panel" data-gap="tight">
      <span className="opr-label">Linkler</span>
      {rows.map((l) => (
        <div key={l.id} className="opr-link">
          <a href={l.url} target="_blank" rel="noreferrer">
            <span className="text-base">{l.label}</span>
            <span className="opr-link-url">{l.url}</span>
          </a>
          <BoardIcon name="expand" className="size-icon-xs text-text-secondary" stroke={1.8} />
          {l.from ? null : <button type="button" className="opr-link-del" aria-label={`${l.label} linkini sil`} onClick={() => del(l)}>Sil</button>}
        </div>
      ))}
      {adding ? (
        <div className="opr-link-form">
          <input className="inp" placeholder="Ad (ör. Roadmap)" aria-label="Link adı" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          <div className="flex gap-3">
            <input className="inp min-w-0 flex-1" placeholder="https://…" aria-label="Link adresi" value={url}
              onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void submit())} />
            <button type="button" className="btn btn-sec" disabled={busy || !ready} onClick={() => void submit()}>Ekle</button>
          </div>
        </div>
      ) : (
        <button type="button" className="opr-dashed" onClick={() => setAdding(true)}>Link ekle</button>
      )}
    </div>
  );
}
