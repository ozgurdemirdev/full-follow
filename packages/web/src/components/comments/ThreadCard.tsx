import { memo, useLayoutEffect, useRef, useState } from "react";
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
  /** the card was opened: an unread answer counts as seen */
  onSeen: (id: number) => void;
  /** the thread was reopened: show the tab it now belongs to */
  onReopened: (tab: CTab) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  // grows with the text; the CSS height (one line) is kept while it is empty
  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = "";
    if (a.value) a.style.height = `${a.scrollHeight}px`;
  }, [draft]);
  const kind = kindOf(t.target_type);
  const href = targetHref(t);
  const chip = STATE_CHIP[state];
  const quick = state === "you" ? optionsOf(t) : [];
  // the first touch of an unread card tells the API once; a read card never asks
  const marked = useRef(false);
  const open = () => {
    if (state !== "answered" || marked.current) return;
    marked.current = true;
    onSeen(t.id);
    void run("post", `/comments/${t.id}/read`, undefined, { silent: true }).catch(() => {});
  };

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
  const send = (e: { preventDefault: () => void }) => {
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
    <article data-record={`comment-${t.id}`} data-s={state} className="cmt-card" onPointerDown={open} onFocus={open}>
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
            <textarea ref={area} rows={1} value={draft} aria-label="Cevap yaz" placeholder="Cevap yaz"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send(e))} />
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
