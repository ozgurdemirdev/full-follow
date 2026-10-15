import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChatMessage } from "../api";
import { CHAT_UI, T } from "../chatText";
import { MessageBubble } from "./MessageBubble";

interface Props {
  sessionId: number | null;
  messages: ChatMessage[];
  hasMore: boolean;
  loading: boolean;
  loadOlder: () => Promise<void>;
  onRetrySend: (m: ChatMessage) => void;
  onRetryReply: () => void;
  onOpenRecord: (type: string, id: number) => void;
}

/**
 * Scroll rules: stick to the bottom only when the user was within stickPx of it, otherwise offer a "new message" pill;
 * a ResizeObserver keeps it pinned when the viewport shrinks (composer grows, banner shows); older pages keep the visual position.
 */
export function Thread({ sessionId, messages, hasMore, loading, loadOlder, onRetrySend, onRetryReply, onOpenRecord }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [pill, setPill] = useState(false);
  const prev = useRef({ first: 0, last: 0, key: "", height: 0 });
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
    const key = lastMsg ? `${lastMsg.id}:${lastMsg.body.length}:${lastMsg.state}` : "";
    const p = prev.current;
    if (p.first && first && first < p.first && lastMsg?.id === p.last) {
      t.scrollTop += t.scrollHeight - p.height;
    } else if (key !== p.key) {
      if (atBottom.current) t.scrollTop = t.scrollHeight;
      else if (p.key) setPill(true);
    }
    prev.current = { first, last: lastMsg?.id ?? 0, key, height: t.scrollHeight };
  }, [messages]);

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

  useEffect(() => {
    const t = el.current;
    const s = top.current;
    if (!t || !s || !hasMore) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || loadingOlder.current) return;
        loadingOlder.current = true;
        void loadOlder().finally(() => (loadingOlder.current = false));
      },
      { root: t },
    );
    io.observe(s);
    return () => io.disconnect();
  }, [hasMore, loadOlder]);

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
            <MessageBubble key={m.client_id && m.role === "user" ? m.client_id : m.id} message={m} next={m.role === "user" ? messages[i + 1] : undefined} onRetrySend={onRetrySend} onRetryReply={onRetryReply} onOpenRecord={onOpenRecord} />
          ))
        )}
      </div>
      {pill && <button type="button" className="newpill" onClick={toBottom}>{T.newMessage}</button>}
    </>
  );
}
