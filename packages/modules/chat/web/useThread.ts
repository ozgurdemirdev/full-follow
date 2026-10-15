import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@kit/api/client";
import { chatApi, type ChatAttachment, type ChatLimits, type ChatMessage, type ChatPhase, type ChatSession, type ChatUsage } from "./api";
import { useChatStream, type Connection } from "./useChatStream";

export interface Live {
  messageId: number;
  phase: ChatPhase;
  tool?: string;
  /** when the reply started, for the seconds counter */
  since: number;
}
export interface ThreadEvents {
  onSession: (s: ChatSession) => void;
  onUsage: (u: ChatUsage) => void;
  onLimits: (l: ChatLimits) => void;
  onFinished: (m: ChatMessage) => void;
  /** Claude opened a record: { message_id, type, id, at } */
  onNavigate: (n: { type: string; id: number; at: number }) => void;
}

const isActive = (m: ChatMessage) => m.role === "assistant" && (m.state === "pending" || m.state === "streaming");

/** Newest page from a refetch: replaces rows with the same id, keeps older rows already loaded and unconfirmed bubbles */
function mergeNewest(prev: ChatMessage[], fresh: ChatMessage[]): ChatMessage[] {
  const first = fresh[0]?.id ?? Infinity;
  const older = prev.filter((m) => m.id > 0 && m.id < first);
  const local = prev.filter((m) => m.id < 0);
  return [...older, ...fresh, ...local];
}

/**
 * Messages of one session: newest page first, older pages on demand, live deltas from the stream.
 * A delta is applied only when its offset equals the local body length (replay after F5 never duplicates words).
 */
export function useThread(sessionId: number | null, ev: ThreadEvents) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** first page loaded and stream url known: safe to send */
  const [ready, setReady] = useState(false);
  const events = useRef(ev);
  /** body length per assistant message, kept outside state so the offset check sees pending deltas too */
  const lens = useRef(new Map<number, number>());
  const pending = useRef(new Map<number, string>());
  const frame = useRef(0);
  const sid = useRef(sessionId);
  useEffect(() => {
    events.current = ev;
    sid.current = sessionId;
  });

  const remember = (list: ChatMessage[]) => list.forEach((m) => m.role === "assistant" && lens.current.set(m.id, m.body.length));

  const load = useCallback(async (id: number, replace: boolean) => {
    const r = await chatApi.messages(id);
    if (sid.current !== id) return;
    remember(r.items);
    pending.current.clear();
    setMessages((prev) => (replace ? r.items : mergeNewest(prev, r.items)));
    if (replace) setHasMore(r.has_more);
    const running = r.items.find((m) => m.id === r.running_message_id);
    setLive((l) => {
      if (!running) return null;
      return l?.messageId === running.id ? l : { messageId: running.id, phase: running.state === "pending" ? "queued" : "writing", since: Date.now() };
    });
    return r;
  }, []);

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setLive(null);
    setStreamUrl(null);
    setReady(false);
    lens.current.clear();
    pending.current.clear();
    if (!sessionId) return;
    setLoading(true);
    load(sessionId, true)
      .then((r) => {
        if (!r) return;
        setStreamUrl(chatApi.streamUrl(sessionId, r.stream_seq));
        setReady(true);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [sessionId, load]);

  const flushDeltas = useCallback(() => {
    frame.current = 0;
    const batch = new Map(pending.current);
    pending.current.clear();
    setMessages((prev) => prev.map((m) => (batch.has(m.id) ? { ...m, body: m.body + batch.get(m.id), state: "streaming" } : m)));
  }, []);

  const onStream = useCallback((name: string, d: any) => {
    const id = sid.current;
    if (!id) return;
    switch (name) {
      case "status":
        setLive((l) => ({ messageId: d.message_id, phase: d.state, tool: d.tool, since: l && l.messageId === d.message_id ? l.since : Date.now() }));
        break;
      case "delta": {
        const have = lens.current.get(d.message_id);
        if (have === undefined || d.offset > have) {
          void load(id, false);
          return;
        }
        if (d.offset < have) return;
        lens.current.set(d.message_id, have + d.text.length);
        pending.current.set(d.message_id, (pending.current.get(d.message_id) ?? "") + d.text);
        frame.current ||= requestAnimationFrame(flushDeltas);
        break;
      }
      case "message":
        lens.current.set(d.id, d.body.length);
        pending.current.delete(d.id);
        setMessages((prev) => prev.map((m) => (m.id === d.id ? d : m)));
        setLive((l) => (l?.messageId === d.id ? null : l));
        events.current.onFinished(d);
        break;
      case "usage":
        events.current.onUsage(d);
        break;
      case "session":
        events.current.onSession(d);
        break;
      case "limits":
        events.current.onLimits(d);
        break;
      case "ack":
        // Claude decided to acknowledge: the thumbs up appears before the reply finishes
        setMessages((prev) => prev.map((m) => (m.id === d.message_id ? { ...m, ack: true } : m)));
        break;
      case "navigate":
        events.current.onNavigate(d);
        break;
      case "snapshot":
        void load(id, false);
        break;
    }
  }, [flushDeltas, load]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const connection: Connection = useChatStream(streamUrl, onStream);

  const loadOlder = useCallback(async () => {
    const id = sid.current;
    const first = messages.find((m) => m.id > 0);
    if (!id || !first) return;
    const r = await chatApi.messages(id, first.id);
    if (sid.current !== id) return;
    remember(r.items);
    setMessages((prev) => [...r.items, ...prev]);
    setHasMore(r.has_more);
  }, [messages]);

  /** Optimistic bubble first; a failed send keeps the same client_id so retrying is idempotent */
  const send = useCallback(async (id: number, body: string, clientId: string, files: ChatAttachment[] = [], mode: "text" | "voice" = "text"): Promise<ApiError | null> => {
    const temp: ChatMessage = { id: -Date.now(), session_id: id, role: "user", body, state: "done", client_id: clientId, tools_json: null, error: null, created_at: new Date().toISOString(), local: "sending", input_mode: mode, attachments: files, attachment_ids: files.map((f) => f.id) };
    setMessages((prev) => [...prev.filter((m) => m.client_id !== clientId), temp]);
    try {
      const r = await chatApi.send(id, { body, client_id: clientId, attachment_ids: files.map((f) => f.id), input_mode: mode });
      if (sid.current !== id) return null;
      const reply = r.assistant_message;
      if (reply) lens.current.set(reply.id, reply.body.length);
      setMessages((prev) => {
        const rest = prev.filter((m) => m.client_id !== clientId && m.id !== reply?.id && m.id !== r.user_message.id);
        return [...rest, r.user_message, ...(reply ? [reply] : [])];
      });
      if (reply && isActive(reply)) setLive((l) => l ?? { messageId: reply.id, phase: "queued", since: Date.now() });
      return null;
    } catch (e) {
      setMessages((prev) => prev.map((m) => (m.client_id === clientId && m.local ? { ...m, local: "failed" } : m)));
      return e instanceof ApiError ? e : null;
    }
  }, []);

  const stop = useCallback(() => {
    if (sid.current) void chatApi.stop(sid.current);
  }, []);

  return { messages, hasMore, live, loading, ready, connection, send, stop, loadOlder };
}
