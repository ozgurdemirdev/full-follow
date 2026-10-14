import { useRef, useState } from "react";
import { remove, run } from "../api/actions";
import type { FileRow } from "../api/types";
import { fmtDay, fmtSize } from "../lib/format";
import { FILE_ACCEPT } from "../lib/labels";
import { Card, Empty } from "./ui";

/** Download address of a stored file (images and PDF open in the tab) */
export const fileHref = (id: number) => `/api/files/${id}`;

/** Files of an opportunity or project: upload, open, delete (into the trash) */
export function FilesCard({ type, id, files }: { type: "opportunity" | "project"; id: number; files: FileRow[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.append("target_type", type);
    form.append("target_id", String(id));
    form.append("file", file);
    setBusy(true);
    try {
      await run("post", "/files", form, { ok: "Dosya eklendi" });
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <Card title="Dosyalar" className="opp-side rise">
      {!files.length ? <Empty>Teklif PDF’i, sunum, sözleşme gibi dosyaları buraya ekle.</Empty> : null}
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-3">
          <a href={fileHref(f.id)} target="_blank" rel="noreferrer" className="min-w-0 flex-grow truncate text-base-sm" title={f.name}>{f.name}</a>
          <span className="flex-none text-sm text-text-muted">{fmtSize(f.size)} · {fmtDay(f.created_at)}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove(`/files/${f.id}`, `“${f.name}” dosyası`).catch(() => {})}>Sil</button>
        </div>
      ))}
      <input ref={input} type="file" accept={FILE_ACCEPT} className="hidden" aria-label="Dosya seç" onChange={(e) => void upload(e.target.files?.[0])} />
      <button type="button" className="btn btn-sec self-start" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Yükleniyor" : "Dosya ekle"}</button>
    </Card>
  );
}
