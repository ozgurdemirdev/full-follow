import { useState } from "react";
import { useLinks } from "@kit/components/LinksCard";
import { BoardIcon } from "@kit/components/boardIcons";
import { m as kit } from "@kit/messages";

import { m } from "../messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

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
      <span className="opr-label">{kit.nouns.links}</span>
      {rows.map((l) => (
        <div key={l.id} className="opr-link">
          <a href={l.url} target="_blank" rel="noreferrer">
            <span className="text-base">{l.label}</span>
            <span className="opr-link-url">{l.url}</span>
          </a>
          <BoardIcon name="expand" className="size-icon-xs text-text-secondary" stroke={STROKE.thin} />
          {l.from ? null : <button type="button" className="opr-link-del" aria-label={m.links.deleteLink(l.label)} onClick={() => del(l)}>{kit.delete}</button>}
        </div>
      ))}
      {adding ? (
        <div className="opr-link-form">
          <input className="inp" placeholder={m.links.namePlaceholder} aria-label={m.links.nameLabel} value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
          <div className="flex gap-3">
            <input className="inp min-w-0 flex-1" placeholder={m.links.urlPlaceholder} aria-label={m.links.urlLabel} value={url}
              onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void submit())} />
            <button type="button" className="btn btn-sec" disabled={busy || !ready} onClick={() => void submit()}>{kit.add}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="opr-dashed" onClick={() => setAdding(true)}>{m.links.add}</button>
      )}
    </div>
  );
}
