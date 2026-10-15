// Kayıt kartlarında ortak parçalar: bölüm başlığı, değer satırı, yorumlar, düzenle/sil
import { useState, type ReactNode } from "react";
import { run } from "../api/actions";
import type { Thread } from "../api/types";
import { openSheet } from "../app/ui";
import { ago } from "../lib/format";
import { Who } from "./ui";

/** A label above a value (the facts panels of the person overlay, and the contributions other modules make to them) */
export const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm text-text-muted">{label}</span>
    <span className="text-base">{children}</span>
  </div>
);

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-base-sm font-medium text-text-secondary">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Kartın sağ üstündeki küçük düzenle / sil düğmeleri */
export function EditDelete({ onEdit, onDelete, label = "" }: { onEdit?: () => void; onDelete?: () => void; label?: string }) {
  return (
    <span className="flex flex-none gap-1">
      {onEdit ? <button type="button" className="btn btn-ghost btn-sm" aria-label={`${label} düzenle`.trim()} onClick={onEdit}>Düzenle</button> : null}
      {onDelete ? <button type="button" className="btn btn-ghost btn-sm text-danger" aria-label={`${label} sil`.trim()} onClick={onDelete}>Sil</button> : null}
    </span>
  );
}

/** Kayda bağlı yorum konuları (Claude ile) */
export function Comments({ target, threads }: { target: { type: string; id: number; label: string }; threads: Thread[] }) {
  return (
    <Section title="Yorumlar (Claude ile)" right={
      <button type="button" className="btn btn-ghost px-0 text-base-sm" onClick={() => openSheet("comment", { target })}>Yeni konu</button>
    }>
      {threads.length === 0 ? <span className="text-base-sm text-text-muted">Claude’a bu kayıtla ilgili soru ya da not yazabilirsin.</span> : null}
      {threads.map((t) => <ThreadBox key={t.id} t={t} />)}
    </Section>
  );
}

function ThreadBox({ t }: { t: Thread }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await run("post", "/comments", { reply_to: t.id, body: reply.trim() }, { ok: "Cevap yazıldı" });
      setReply("");
    } catch {
      /* bildirim run() içinde */
    } finally {
      setBusy(false);
    }
  };
  const msgs = t.comments ?? [{ id: t.last_id, created_by: t.last_by, body: t.last_body, created_at: t.last_at }];
  return (
    <div className={`inset flex flex-col gap-4 px-6 py-5 ${t.resolved_at ? "opacity-muted" : ""}`}>
      {msgs.map((m) => (
        <div key={m.id} className="flex items-start gap-3">
          <Who actor={m.created_by} className="w-comment-who justify-center" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="whitespace-pre-line text-base-sm leading-normal">{m.body}</span>
            <span className="text-sm text-text-muted">{ago(m.created_at)}</span>
          </div>
        </div>
      ))}
      {!t.resolved_at ? (
        <div className="flex gap-3">
          <input className="inp min-w-0 flex-1" placeholder="Cevap yaz" aria-label="Cevap yaz" value={reply}
            onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), send())} />
          <button type="button" className="btn btn-sec" disabled={busy || !reply.trim()} onClick={send}>Cevapla</button>
        </div>
      ) : <span className="text-sm text-text-muted">Konu kapandı</span>}
    </div>
  );
}
