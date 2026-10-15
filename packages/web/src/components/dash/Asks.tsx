import { useState } from "react";
import { Link } from "wouter";
import { run } from "../../api/actions";
import { useThreads } from "../../api/keys";
import type { Thread } from "../../api/types";
import { PATHS } from "../../app/routes";
import { ago } from "../../lib/format";
import { TARGET } from "../../lib/labels";
import { m as kit } from "../../messages";
import { comments } from "../../messages.comments";
import { BoardIcon } from "../boardIcons";

const m = comments.asks;

const COMMENTS_WAITING = `${PATHS.comments}?f=mine`;

/** One question of Claude: the answer is written in place */
function AskCard({ t }: { t: Thread }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await run("post", "/comments", { reply_to: t.id, body: text.trim() }, { ok: comments.replied });
    } catch {
      setBusy(false);
    }
  };

  return (
    <article className="dash-wait">
      <div className="flex items-center gap-3 text-sm">
        <span className="dash-chip bg-chip-ask-bg text-chip-ask-fg">{m.chip}</span>
        <span className="truncate text-text-neutral-chip">{TARGET[t.target_type] ?? t.target_type}: {t.target_label}</span>
        <span className="flex-grow" />
        <span className="whitespace-nowrap text-text-muted">{ago(t.last_at)}</span>
      </div>
      <span className="text-base leading-snug">{t.last_body}</span>
      <span className="text-sm text-warning">{m.waiting}</span>
      {open ? (
        <div className="mt-auto flex flex-col gap-3">
          <textarea className="inp" aria-label={kit.writeReply} placeholder={kit.writeReply} rows={2} value={text} autoFocus
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void send())} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="dash-btn is-small is-primary" disabled={busy || !text.trim()} onClick={() => void send()}>{kit.send}</button>
            <button type="button" className="dash-btn is-small" onClick={() => setOpen(false)}>{kit.cancel}</button>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex flex-wrap gap-2">
          <button type="button" className="dash-btn is-small" onClick={() => setOpen(true)}>{kit.reply}</button>
          <Link href={COMMENTS_WAITING} className="dash-btn is-small">{m.toThread}</Link>
        </div>
      )}
    </article>
  );
}

/** "Senden bekleyenler": open threads where Claude asked and nobody answered yet; hidden when there are none */
export function Asks() {
  const threads = useThreads();
  const rows = threads.rows.filter((t) => t.last_by === "claude" && !t.resolved_at);
  if (!rows.length) return null;
  return (
    <section aria-label={m.title} className="dash-ask rise">
      <div className="flex flex-wrap items-center gap-4">
        <span className="dash-ask-dot" />
        <h2 className="m-0 flex-grow text-xl font-regular tracking-subtitle">{m.title}</h2>
        <span className="text-base-sm text-text-secondary">{m.count(rows.length)}</span>
        <Link href={COMMENTS_WAITING} className="ff-more">
          {kit.all}
          <span className="ff-more-ic"><BoardIcon name="expand" className="size-icon-chip" stroke={2.2} /></span>
        </Link>
      </div>
      <div className="dash-waits">
        {rows.map((t) => <AskCard key={t.id} t={t} />)}
      </div>
    </section>
  );
}
