import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, ChatPermission } from "../api";
import { T } from "../messages";
import { CHAT_UI } from "../constants";
import { MessageBubble } from "./MessageBubble";
import { PermissionCard } from "./PermissionCard";

interface Props {
  sessionId: number | null;
  messages: ChatMessage[];
  hasMore: boolean;
  loading: boolean;
  loadOlder: () => Promise<void>;
  /** the confirmations Claude asked for, each shown under the reply it belongs to */
  permissions: ChatPermission[];
  /** the running reply: only its cards can still be answered */
  liveMessageId: number | null;
  permissionTimeoutMs: number;
  onAnswer: (id: number, allow: boolean) => Promise<void>;
  onRetrySend: (m: ChatMessage) => void;
  onRetryReply: () => void;
  onOpenRecord: (type: string, id: number) => void;
}

/**
 * Scroll rules: stick to the bottom only when the user was within stickPx of it, otherwise offer a "new message" pill;
 * a ResizeObserver keeps it pinned when the viewport shrinks (composer grows, banner shows); older pages keep the visual position.
 */
export function Thread({ sessionId, messages, hasMore, loading, loadOlder, permissions, liveMessageId, permissionTimeoutMs, onAnswer, onRetrySend, onRetryReply, onOpenRecord }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [pill, setPill] = useState(false);
  const prev = useRef({ first: 0, last: 0, key: "", height: 0 });
  /** cards by the reply they hang on; one asked outside a reply goes after the last message */
  const cardsOf = useMemo(() => {
    const by = new Map<number | null, ChatPermission[]>();
    for (const p of permissions) by.set(p.message_id, [...(by.get(p.message_id) ?? []), p]);
    return by;
  }, [permissions]);
  const cards = (list: ChatPermission[] | undefined) =>
    list?.map((p) => <PermissionCard key={p.id} card={p} active={p.message_id === liveMessageId} timeoutMs={permissionTimeoutMs} onAnswer={onAnswer} />);
  const loadingOlder = useRef(false);

  const toBottom = () => {
    const t = el.current;
    if (t) t.scrollTop = t.scrollHeight;
    atBottom.current = true;
    setPill(false);
  };

  useLayoutEffect(() => {
    const t = el.current;
    if (!t) return;
    const first = messages[0]?.id ?? 0;
    const lastMsg = messages[messages.length - 1];
    const key = lastMsg ? `${lastMsg.id}:${lastMsg.body.length}:${lastMsg.state}:${permissions.length}:${permissions.at(-1)?.state ?? ""}` : "";
    const p = prev.current;
    if (p.first && first && first < p.first && lastMsg?.id === p.last) {
      t.scrollTop += t.scrollHeight - p.height;
    } else if (key !== p.key) {
      if (atBottom.current) t.scrollTop = t.scrollHeight;
      else if (p.key) setPill(true);
    }
    prev.current = { first, last: lastMsg?.id ?? 0, key, height: t.scrollHeight };
  }, [messages, permissions]);

  useEffect(() => {
    prev.current = { first: 0, last: 0, key: "", height: 0 };
    atBottom.current = true;
    setPill(false);
  }, [sessionId]);

  useEffect(() => {
    const t = el.current;
    if (!t) return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) t.scrollTop = t.scrollHeight;
    });
    ro.observe(t);
    return () => ro.disconnect();
  }, []);

  // rebuilt when messages are added, not when loadOlder is new (see SessionList)
  const older = useRef(loadOlder);
  useEffect(() => {
    older.current = loadOlder;
  });
  useEffect(() => {
    const t = el.current;
    const s = top.current;
    if (!t || !s || !hasMore) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || loadingOlder.current) return;
        loadingOlder.current = true;
        void older.current().finally(() => (loadingOlder.current = false));
      },
      { root: t },
    );
    io.observe(s);
    return () => io.disconnect();
  }, [hasMore, messages.length]);

  const onScroll = () => {
    const t = el.current;
    if (!t) return;
    atBottom.current = t.scrollHeight - t.scrollTop - t.clientHeight <= CHAT_UI.stickPx;
    if (atBottom.current) setPill(false);
  };

  return (
    <>
      <div className="thread" ref={el} onScroll={onScroll} aria-label={T.messages}>
        <div ref={top} aria-hidden="true" />
        {hasMore && (
          <button type="button" className="older" onClick={() => void loadOlder()}>{T.older}</button>
        )}
        {!messages.length && !loading ? (
          <div className="cempty">
            <h3>{T.emptyTitle}</h3>
            <p>{T.emptyHint}</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <Fragment key={m.client_id && m.role === "user" ? m.client_id : m.id}>
              <MessageBubble message={m} next={m.role === "user" ? messages[i + 1] : undefined} onRetrySend={onRetrySend} onRetryReply={onRetryReply} onOpenRecord={onOpenRecord} />
              {m.role === "assistant" && cards(cardsOf.get(m.id))}
            </Fragment>
          ))
        )}
        {cards(cardsOf.get(null))}
      </div>
      {pill && <button type="button" className="newpill" onClick={toBottom}>{T.newMessage}</button>}
    </>
  );
}
