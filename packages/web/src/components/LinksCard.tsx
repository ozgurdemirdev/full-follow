import { useState } from "react";
import { remove, run } from "../api/actions";
import { useQuery } from "../api/store";
import type { LinkRow, List } from "../api/types";
import { Empty, SideSection } from "./ui";

/** Labelled links on an opportunity, project or own project (roadmap, proposal deck, Figma, repo) */
export function LinksCard({ type, id, plain }: { type: "opportunity" | "project" | "own_project"; id: number; plain?: boolean }) {
  const links = useQuery<List<LinkRow>>(`/links?${type}_id=${id}&limit=200`);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = !!label.trim() && !!url.trim();
  const add = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const href = /^[a-z]+:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      await run("post", "/links", { target_type: type, target_id: id, label: label.trim(), url: href }, { ok: "Link eklendi" });
      setLabel("");
      setUrl("");
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  const rows = links.data?.rows ?? [];
  return (
    <SideSection title="Linkler" plain={plain}>
      {links.data && !rows.length ? <Empty>Roadmap, teklif sunumu, Figma, repo gibi linkleri buraya ekle.</Empty> : null}
      {rows.map((l) => (
        <div key={l.id} className="flex items-center gap-3">
          <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-grow truncate text-base-sm" title={l.url}>{l.label}</a>
          {l.from ? <span className="text-sm text-text-muted">{l.from}</span> : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(`/links/${l.id}`, `“${l.label}” linki`).catch(() => {})}>Sil</button>
          )}
        </div>
      ))}
      <div className="flex flex-col gap-3">
        <input className="inp" placeholder="Ad (ör. Roadmap)" aria-label="Link adı" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex gap-3">
          <input className="inp min-w-0 flex-1" placeholder="https://…" aria-label="Link adresi" value={url}
            onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
          <button type="button" className="btn btn-sec" disabled={busy || !ready} onClick={add}>Ekle</button>
        </div>
      </div>
    </SideSection>
  );
}
