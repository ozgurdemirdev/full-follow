import { memo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { run } from "../../api/actions";
import type { Thread } from "../../api/types";
import { kindOf, optionsOf, reopenTab, STATE_CHIP, targetHref, type CState, type CTab } from "../../lib/comments";
import { BoardIcon } from "../boardIcons";
import { Bubble } from "./Bubble";

/** The comments of a thread; a list that came without them still shows its last one */
const messagesOf = (t: Thread) =>
  t.comments?.length
    ? t.comments.map((c) => ({ id: c.id, by: c.created_by, body: c.body, at: c.created_at }))
    : [{ id: t.last_id, by: t.last_by, body: t.last_body, at: t.last_at }];

/** One thread: the record and its state, the messages, quick answers, the reply box and close or reopen */
export const ThreadCard = memo(function ThreadCard({ t, state, onSeen, onReopened }: {
  t: Thread;
  state: CState;
  /** the reply box was touched: an unread answer counts as seen */
  onSeen: (id: number) => void;
  /** the thread was reopened: show the tab it now belongs to */
  onReopened: (tab: CTab) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const kind = kindOf(t.target_type);
  const href = targetHref(t);
  const chip = STATE_CHIP[state];
  const quick = state === "you" ? optionsOf(t) : [];

  const guard = async (job: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await job();
    } catch {
      /* the toast is shown by run() */
    } finally {
      setBusy(false);
    }
  };
  const reply = (body: string) =>
    guard(async () => {
      await run("post", "/comments", { reply_to: t.id, body }, { ok: "Cevap yazıldı" });
      setDraft("");
    });
  const send = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (body && !busy) void reply(body);
  };
  const setResolved = (resolved: boolean) =>
    guard(async () => {
      await run("post", `/comments/${t.id}/resolve`, { resolved }, { ok: resolved ? `${t.target_label} konusu kapandı` : "Konu yeniden açıldı" });
      if (!resolved) onReopened(reopenTab(t));
    });

  const recChip = (
    <>
      <span className={`size-dot-sm shrink-0 rounded-pill ${kind.dot}`} />
      <span className="truncate">{t.target_label}</span>
      <span className="shrink-0 text-text-muted">{kind.label}</span>
    </>
  );

  return (
    <article data-record={`comment-${t.id}`} data-s={state} className="cmt-card">
      <div className="cmt-top">
        {href ? <Link href={href} className="cmt-rec">{recChip}</Link> : <span className="cmt-rec">{recChip}</span>}
        <span className="flex-grow" />
        <span className={`cmt-state ${chip.cls}`}>{chip.label}</span>
      </div>
      <div className="cmt-msgs">
        {messagesOf(t).map((m) => <Bubble key={m.id} by={m.by} text={m.body} at={m.at} />)}
      </div>
      {quick.length ? (
        <div className="cmt-quick">
          {quick.map((q) => <button key={q} type="button" disabled={busy} onClick={() => void reply(q)}>{q}</button>)}
        </div>
      ) : null}
      {state !== "closed" ? (
        <div className="cmt-reply">
          <form className="cmt-field" onSubmit={send}>
            <input type="text" value={draft} aria-label="Cevap yaz" placeholder="Cevap yaz"
              onChange={(e) => (setDraft(e.target.value), onSeen(t.id))} />
            <button type="submit" className="cmt-send" aria-label="Gönder" disabled={busy}>
              <BoardIcon name="arrowRight" className="size-icon-xs" stroke={2.4} />
            </button>
          </form>
          <button type="button" className="cmt-close" title="Konu kapandı" aria-label="Konu kapandı" disabled={busy} onClick={() => void setResolved(true)}>
            <BoardIcon name="check" className="size-icon-chip" stroke={2.2} />
          </button>
        </div>
      ) : (
        <button type="button" className="cmt-reopen" disabled={busy} onClick={() => void setResolved(false)}>Konuyu yeniden aç</button>
      )}
    </article>
  );
});
