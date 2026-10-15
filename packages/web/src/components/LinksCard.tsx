import { useState } from "react";
import { remove, run } from "../api/actions";
import { useQuery } from "../api/store";
import type { LinkRow, List } from "../api/types";
import { LINKS_LIMIT } from "../lib/constants";
import { m as kit } from "../messages";
import { parts } from "../messages.parts";
import { Empty, SideSection } from "./ui";

const m = parts.links;

export type LinkTarget = "opportunity" | "project" | "own_project";

/** Links of a record plus the add form state: shared by the old card and the own projects overlay panel */
export function useLinks(type: LinkTarget, id: number) {
  const links = useQuery<List<LinkRow>>(`/links?${type}_id=${id}&limit=${LINKS_LIMIT}`);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = !!label.trim() && !!url.trim();
  const add = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      const href = /^[a-z]+:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      await run("post", "/links", { target_type: type, target_id: id, label: label.trim(), url: href }, { ok: m.added });
      setLabel("");
      setUrl("");
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  const del = (l: LinkRow) => void remove(`/links/${l.id}`, m.named(l.label)).catch(() => {});
  return { loaded: !!links.data, rows: links.data?.rows ?? [], label, setLabel, url, setUrl, busy, ready, add, del };
}

/** Labelled links on an opportunity, project or own project (roadmap, proposal deck, Figma, repo) */
export function LinksCard({ type, id, plain }: { type: LinkTarget; id: number; plain?: boolean }) {
  const { loaded, rows, label, setLabel, url, setUrl, busy, ready, add, del } = useLinks(type, id);
  return (
    <SideSection title={m.title} plain={plain}>
      {loaded && !rows.length ? <Empty>{m.empty}</Empty> : null}
      {rows.map((l) => (
        <div key={l.id} className="flex items-center gap-3">
          <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-grow truncate text-base-sm" title={l.url}>{l.label}</a>
          {l.from ? <span className="text-sm text-text-muted">{l.from}</span> : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => del(l)}>{kit.delete}</button>
          )}
        </div>
      ))}
      <div className="flex flex-col gap-3">
        <input className="inp" placeholder={m.labelPlaceholder} aria-label={m.labelAria} value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex gap-3">
          <input className="inp min-w-0 flex-1" placeholder={m.urlPlaceholder} aria-label={m.urlAria} value={url}
            onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
          <button type="button" className="btn btn-sec" disabled={busy || !ready} onClick={add}>{kit.add}</button>
        </div>
      </div>
    </SideSection>
  );
}
