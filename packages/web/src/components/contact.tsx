// Kişi ve firma kartlarında ortak parçalar: bölüm başlığı, iletişim listesi, temaslar, yorumlar, düzenle/sil
import { useState, type ReactNode } from "react";
import { remove, run } from "../api/actions";
import type { Labeled, Thread, Touch } from "../api/types";
import { openSheet } from "../app/ui";
import { ago } from "../lib/format";
import { CHANNEL_DOT } from "../lib/labels";
import { channelName, profileUrl } from "../lib/network";
import { Chip, StatusChip, Tags, Who } from "./ui";

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

/** Etiketler, sektörler, nereden buldum ve temas durumu tek satır */
export function LabelLine({ r, children }: { r: Labeled; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2">
      <StatusChip status={r.contact_status} />
      <Tags ids={r.tag_ids} />
      {r.sectors.map((s) => <Chip key={s.id}>{s.path}</Chip>)}
      {r.source_name ? <Chip tone="source">{r.source_name}</Chip> : null}
      {children}
    </div>
  );
}

export interface ContactFields {
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  website?: string | null;
  handle?: string | null;
}

export function ContactList({ c }: { c: ContactFields }) {
  const items: { label: string; node: ReactNode }[] = [];
  if (c.email) items.push({ label: "E-posta", node: <a href={`mailto:${c.email}`}>{c.email}</a> });
  if (c.phone) items.push({ label: "Telefon", node: <a href={`tel:${c.phone}`}>{c.phone}</a> });
  if (c.website) items.push({ label: "Web", node: <a href={/^https?:\/\//i.test(c.website) ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer">{c.website}</a> });
  if (c.instagram) items.push({ label: "Instagram", node: <a href={profileUrl("instagram", c.instagram)} target="_blank" rel="noreferrer">{c.instagram}</a> });
  if (c.linkedin) items.push({ label: "LinkedIn", node: <a href={profileUrl("linkedin", c.linkedin)} target="_blank" rel="noreferrer">{c.linkedin}</a> });
  if (c.handle) items.push({ label: "Diğer", node: <span>{c.handle}</span> });
  if (!items.length) return null;
  return (
    <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 text-base-sm desk:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="flex min-w-0 gap-3">
          <dt className="flex-none text-text-muted">{it.label}</dt>
          <dd className="m-0 min-w-0 truncate text-text-primary">{it.node}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Temas listesi: her temasta düzenle ve sil (geri alınabilir); firma kartında kime yazıldığı da görünür */
export function TouchList({ list, showTo }: { list: Touch[]; showTo?: boolean }) {
  const [all, setAll] = useState(false);
  const shown = all ? list : list.slice(0, 8);
  const stopWaiting = (t: Touch) => run("patch", `/touches/${t.id}`, { expects_reply: false }, { ok: "Cevap beklenmiyor olarak işaretlendi" }).catch(() => {});
  return (
    <ol className="m-0 flex list-none flex-col gap-0 p-0">
      {shown.map((t) => (
        <li key={t.id} className="row flex gap-4 py-4">
          <span className={`dot mt-2 ${CHANNEL_DOT[t.channel] ?? "bg-entity-neutral"}`} />
          <div className="flex min-w-0 flex-grow flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-2 text-sm text-text-secondary">
              <span className={t.direction === "gelen" ? "text-success" : "text-text-primary"}>{t.direction === "gelen" ? "Gelen" : "Giden"}</span>
              <span>{channelName(t.channel)}{t.kind !== "mesaj" ? ` · ${t.kind === "arama" ? "arama" : "görüşme"}` : ""}</span>
              {showTo ? <span className="text-text-primary">· {t.person_id ? t.to_name : "firmaya"}</span> : null}
              <span className="text-text-muted">{ago(t.happened_at)}</span>
              {t.opportunity_title ? <span className="truncate text-text-muted">· {t.opportunity_title}</span> : null}
              <Who actor={t.created_by} />
            </div>
            <p className="m-0 whitespace-pre-line text-base-sm leading-normal text-text-primary">{t.summary}</p>
            {t.outcome ? <span className="text-sm text-text-secondary">→ {t.outcome}</span> : null}
            <div className="flex flex-wrap items-center gap-1">
              {t.expects_reply ? <button type="button" className="btn btn-ghost btn-sm px-0" onClick={() => stopWaiting(t)}>Cevap beklemiyorum</button> : null}
              <span className="flex-grow" />
              <EditDelete label="Temas" onEdit={() => openSheet("touch", { edit: t.id })} onDelete={() => void remove(`/touches/${t.id}`, "Temas").catch(() => {})} />
            </div>
          </div>
        </li>
      ))}
      {list.length > 8 && !all ? (
        <li><button type="button" className="btn btn-ghost px-0 text-base-sm" onClick={() => setAll(true)}>{list.length - 8} temas daha</button></li>
      ) : null}
    </ol>
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
