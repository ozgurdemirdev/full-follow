import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chatApi, type ChatAttachment, type ChatLimits, type ChatMessage, type ChatMeta, type ChatSession, type ChatUsage } from "./api";
import { ChatButton } from "./components/ChatButton";
import { ChatPanel } from "./components/ChatPanel";
import { statusText, useElapsed } from "./components/StatusLine";
import { toast } from "@kit/components/toast";
import { chatBus, chatLive, chatPresence, chatPrefs, IDLE_CHAT_LIVE, useChatOpener, type ChatLive } from "@kit/lib/chatStore";
import { T } from "./messages";
import { CHAT_UI, DRAFT_RUN_LIVE } from "./constants";
import { isDesk } from "@kit/lib/media";
import { useAutoDraft } from "@kit/lib/askClaude";
import { useDraftActive } from "@kit/lib/draftRuns";
import { useSettings } from "@kit/lib/settings";
import { m as kit } from "@kit/messages";
import { useOpenRecord } from "./openRecord";
import { recordCache } from "./recordCache";
import { useThread } from "./useThread";

/** Merge a session row into the list: update in place, or put a new one on top */
const upsert = (list: ChatSession[], s: ChatSession) => (list.some((x) => x.id === s.id) ? list.map((x) => (x.id === s.id ? s : x)) : [s, ...list]);

/**
 * The chat floating window. Lives in App, so it survives page navigation and a running reply keeps streaming
 * while the window is minimized.
 */
export default function ChatWidget() {
  const [open, setOpen] = useState(chatPrefs.open);
  const [large, setLarge] = useState(chatPrefs.large);
  const [sessionId, setSessionId] = useState<number | null>(chatPrefs.session);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const [limits, setLimits] = useState<ChatLimits | null>(null);
  const [ready, setReady] = useState(false);
  const [outcome, setOutcome] = useState<ChatLive["outcome"]>(null);
  const [draft, setDraft] = useState<{ model?: string; effort?: string }>({});
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const queued = useRef<{ sid: number; text: string; clientId: string; files: ChatAttachment[]; mode: "text" | "voice" } | null>(null);
  const listLoaded = useRef(false);
  /** a page of the session list is on its way: the sentinel must not ask for the same page again */
  const pageBusy = useRef(false);

  // while the window is mounted the mascot may open it; when it goes away (module hidden or removed) the mascot's state resets with it
  useEffect(() => {
    chatPresence.set(true);
    return () => {
      chatPresence.set(false);
      chatLive.set(IDLE_CHAT_LIVE);
    };
  }, []);
  // the record chips under the replies read fresh rows whenever the window opens or another session is shown
  useEffect(() => {
    recordCache.clear();
  }, [open, sessionId]);

  const onSession = useCallback((s: ChatSession) => {
    setSession((cur) => (cur?.id === s.id ? s : cur));
    setSessions((l) => upsert(l, s));
  }, []);
  const onUsage = useCallback((u: ChatUsage) => {
    setSession((cur) => (cur ? { ...cur, context_tokens: u.context_tokens, input_tokens_total: u.input_tokens_total, output_tokens_total: u.output_tokens_total, cost_usd_micros_total: u.cost_usd_micros_total } : cur));
  }, []);
  const onFinished = useCallback((m: ChatMessage) => {
    const silent = m.ack && !m.body.trim();
    if (m.state === "done" && !chatPrefs.open() && !silent) setReady(true);
    if ((m.state === "done" && !silent) || m.state === "error") setOutcome((o) => ({ n: (o?.n ?? 0) + 1, error: m.state === "error" }));
    void chatApi.sessions().then((r) => setSessions((l) => r.items.reduce((acc, s) => upsert(acc, s), l)));
  }, []);

  const openRecord = useOpenRecord();
  // Claude opens a record: go there; on a phone the window gets out of the way. Older events are a replay after F5.
  const onNavigate = useCallback((n: { type: string; id: number; at: number }) => {
    if (Date.now() - n.at > CHAT_UI.navigateMaxAgeMs) return;
    openRecord(n.type, n.id);
    if (!isDesk()) {
      setOpen(false);
      chatPrefs.setOpen(false);
    }
  }, [openRecord]);

  const thread = useThread(sessionId, { onSession, onUsage, onLimits: setLimits, onFinished, onNavigate });
  // while a card of the running reply waits for the owner, the reply is waiting for them: the status line and the mascot say so
  const waiting = thread.permissions.some((p) => p.state === "pending" && p.message_id === thread.live?.messageId);
  const live = useMemo(() => (thread.live && waiting ? { ...thread.live, phase: "approval" as const } : thread.live), [thread.live, waiting]);
  const fullAccess = !!useSettings().data?.chat_full_access;

  useEffect(() => {
    void chatApi.meta().then((m) => {
      setMeta(m);
      setLimits((l) => l ?? m.rate_limits);
    });
  }, []);

  const loadSessions = useCallback((from: string | null) => {
    if (pageBusy.current) return;
    pageBusy.current = true;
    void chatApi.sessions(from).then((r) => {
      setSessions((l) => (from ? [...l, ...r.items.filter((s) => !l.some((x) => x.id === s.id))] : r.items.reduce((acc, s) => upsert(acc, s), l)));
      setCursor(r.next_cursor);
      listLoaded.current = true;
    }).finally(() => {
      pageBusy.current = false;
    });
  }, []);
  const loadMoreSessions = useCallback(() => loadSessions(cursor), [loadSessions, cursor]);

  // first open: load the list; with no remembered session, continue the most recent one
  useEffect(() => {
    if (!open || listLoaded.current) return;
    loadSessions(null);
  }, [open, loadSessions]);
  // only the first open decides; "Yeni sohbet" must stay empty even though older sessions exist
  const autoPicked = useRef(false);
  useEffect(() => {
    if (!open || autoPicked.current || !listLoaded.current) return;
    autoPicked.current = true;
    if (sessionId === null && !queued.current && sessions.length) setSessionId(sessions[0].id);
  }, [open, sessionId, sessions]);

  // the session row for the header: from the list, else fetched (a remembered older session)
  useEffect(() => {
    if (sessionId === null) return void setSession(null);
    const known = sessions.find((s) => s.id === sessionId);
    if (known) return void setSession((cur) => (cur?.id === sessionId ? cur : known));
    void chatApi.session(sessionId).then(setSession).catch(() => setSessionId(null));
  }, [sessionId, sessions]);

  useEffect(() => {
    chatPrefs.setSession(sessionId);
  }, [sessionId]);

  const doSend = thread.send;
  useEffect(() => {
    const q = queued.current;
    if (!q || !thread.ready || q.sid !== sessionId) return;
    queued.current = null;
    void doSend(q.sid, q.text, q.clientId, q.files, q.mode).then((e) => e && toast(e.message, "error"));
  }, [thread.ready, sessionId, doSend]);

  const toggle = (next: boolean) => {
    setOpen(next);
    chatPrefs.setOpen(next);
    if (next) {
      setReady(false);
      requestAnimationFrame(() => input.current?.focus());
    }
  };
  const minimize = useCallback(() => {
    setOpen(false);
    chatPrefs.setOpen(false);
    button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && minimize();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, minimize]);

  /** Creates the chat on the first message, uploads the files, then sends; resolves false when nothing was taken (the composer keeps its content) */
  const send = async (text: string, files: File[], mode: "text" | "voice"): Promise<boolean> => {
    const clientId = crypto.randomUUID();
    try {
      let id = sessionId;
      let created: ChatSession | null = null;
      if (!id) {
        created = await chatApi.create({ model: draft.model, effort: draft.effort });
        id = created.id;
      }
      const uploaded = await Promise.all(files.map((f) => chatApi.upload(id, f)));
      if (created) {
        setSessions((l) => upsert(l, created));
        setSession(created);
        queued.current = { sid: id, text, clientId, files: uploaded, mode };
        setSessionId(id);
      } else {
        void thread.send(id, text, clientId, uploaded, mode).then((e) => e && toast(e.message, "error"));
      }
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : T.uploadFailed, "error");
      return false;
    }
  };

  const settings = async (patch: { model?: string; effort?: string }) => {
    if (!sessionId) return setDraft((d) => ({ ...d, ...patch }));
    const s = await chatApi.update(sessionId, patch);
    onSession(s);
  };
  const title = async (t: string) => {
    if (sessionId) onSession(await chatApi.update(sessionId, { title: t }));
  };
  const pick = (id: number) => setSessionId(id);
  const newChat = () => {
    autoPicked.current = true;
    setSessionId(null);
    setDraft({});
    requestAnimationFrame(() => input.current?.focus());
  };
  const retryReply = () => {
    const last = [...thread.messages].reverse().find((m) => m.role === "user");
    if (last && sessionId) void thread.send(sessionId, last.body, crypto.randomUUID()).then((e) => e && toast(e.message, "error"));
  };

  const secs = useElapsed(open ? null : live?.since ?? null);

  // the mascot opens the chat (never closes it): closed -> open and focus the composer, open -> just focus
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });
  useEffect(() => {
    const onOpen = () => (openRef.current ? input.current?.focus() : toggle(true));
    // a draft button opens the run's session to watch Claude write it
    const onSession = (e: Event) => {
      autoPicked.current = true;
      setSessionId((e as CustomEvent<number>).detail);
      if (!openRef.current) toggle(true);
    };
    chatBus.addEventListener("open", onOpen);
    chatBus.addEventListener("session", onSession);
    return () => {
      chatBus.removeEventListener("open", onOpen);
      chatBus.removeEventListener("session", onSession);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // publish what the mascot shows: open, a running reply with its status (or a background draft run), a finished reply nobody saw
  const drafting = useDraftActive(useAutoDraft());
  const status = live ? statusText(live) : drafting ? kit.draftRun.writing : null;
  const since = live?.since ?? null;
  const phase = live?.phase ?? (drafting ? DRAFT_RUN_LIVE.phase : null);
  const tool = live?.tool ?? (drafting ? DRAFT_RUN_LIVE.tool : null);
  useEffect(() => {
    chatLive.set({ open, running: !!live || drafting, ready, status, since, phase, tool, outcome });
  }, [open, live, drafting, ready, status, since, phase, tool, outcome]);
  // the old button stays until the mascot is really there: there is always one way to open the chat
  const mascotUsable = useChatOpener();
  const defaults = meta?.defaults;

  return (
    <>
      {!mascotUsable && <ChatButton
        open={open}
        status={live ? statusText(live) : null}
        seconds={secs}
        ready={ready}
        buttonRef={button}
        onToggle={() => toggle(!open)}
      />}
      <ChatPanel
        open={open}
        large={large}
        meta={meta}
        limits={limits}
        session={session}
        draftModel={draft.model ?? defaults?.model ?? ""}
        draftEffort={draft.effort ?? defaults?.effort ?? ""}
        sessions={sessions}
        sessionsHasMore={cursor !== null}
        loadMoreSessions={loadMoreSessions}
        messages={thread.messages}
        hasMore={thread.hasMore}
        loading={thread.loading}
        live={live}
        permissions={thread.permissions}
        onAnswer={thread.answer}
        fullAccess={fullAccess}
        connection={thread.connection}
        inputRef={input}
        onPickSession={pick}
        onNew={newChat}
        onTitle={title}
        onSettings={settings}
        onToggleLarge={() => {
          setLarge(!large);
          chatPrefs.setLarge(!large);
        }}
        onMinimize={minimize}
        onSend={send}
        onStop={thread.stop}
        onRetrySend={(m) => sessionId && m.client_id && void thread.send(sessionId, m.body, m.client_id, m.attachments, m.input_mode).then((e) => e && toast(e.message, "error"))}
        onRetryReply={retryReply}
        onOpenRecord={openRecord}
        loadOlder={thread.loadOlder}
      />
    </>
  );
}
