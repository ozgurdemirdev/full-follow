import { useEffect, useRef, useState, type Ref } from "react";
import type { ChatLimits, ChatMessage, ChatMeta, ChatSession } from "../../api/chat";
import { T } from "../../lib/chatText";
import type { Connection } from "../../lib/useChatStream";
import type { Live } from "../../lib/useThread";
import { ChatHeader } from "./ChatHeader";
import { Composer, type ComposerApi } from "./Composer";
import { Meters, meterState } from "./Meters";
import { SessionList } from "./SessionList";
import { StatusLine } from "./StatusLine";
import { Thread } from "./Thread";

export interface PanelProps {
  open: boolean;
  large: boolean;
  meta: ChatMeta | null;
  limits: ChatLimits | null;
  session: ChatSession | null;
  /** model and effort shown and used for a chat that does not exist yet */
  draftModel: string;
  draftEffort: string;
  sessions: ChatSession[];
  sessionsHasMore: boolean;
  loadMoreSessions: () => void;
  messages: ChatMessage[];
  hasMore: boolean;
  loading: boolean;
  live: Live | null;
  connection: Connection;
  inputRef: Ref<HTMLTextAreaElement>;
  onPickSession: (id: number) => void;
  onNew: () => void;
  onTitle: (title: string) => void;
  onSettings: (patch: { model?: string; effort?: string }) => void;
  onToggleLarge: () => void;
  onMinimize: () => void;
  onSend: (text: string, files: File[]) => Promise<boolean>;
  onStop: () => void;
  onRetrySend: (m: ChatMessage) => void;
  onRetryReply: () => void;
  loadOlder: () => Promise<void>;
}

export function ChatPanel(p: PanelProps) {
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [popOpen, setPopOpen] = useState(false);
  const [changed, setChanged] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(0);
  const composer = useRef<ComposerApi | null>(null);
  const sessionId = p.session?.id ?? null;
  const state = meterState(p.session, p.meta, p.limits);
  const setupError = p.meta && !p.meta.cli_ok ? (p.meta.cli_error === "mcp_not_built" ? T.mcpNotBuilt : T.cliMissing) : null;
  const model = p.session?.model ?? p.draftModel;
  const effort = p.session?.effort ?? p.draftEffort;

  useEffect(() => {
    if (!popOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as Element).closest(".pop, .mchip")) setPopOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [popOpen]);

  // Escape closes the popover first; the widget's own Escape handler then sees it already closed
  useEffect(() => {
    if (!popOpen) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setPopOpen(false);
    };
    document.addEventListener("keydown", esc, true);
    return () => document.removeEventListener("keydown", esc, true);
  }, [popOpen]);

  const pick = (patch: { model?: string; effort?: string }) => {
    p.onSettings(patch);
    setChanged(true);
  };

  return (
    <section
      id="chat-window"
      className="chat"
      role="dialog"
      aria-label={T.title}
      aria-modal="false"
      data-open={p.open ? "" : undefined}
      data-large={p.large ? "" : undefined}
      data-sessions={sessionsOpen ? "" : undefined}
      inert={!p.open}
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        drag.current++;
        setDragging(true);
      }}
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDragLeave={() => {
        if (--drag.current <= 0) {
          drag.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        drag.current = 0;
        setDragging(false);
        composer.current?.addFiles(e.dataTransfer.files);
      }}
    >
      <button className="scrim" type="button" tabIndex={-1} aria-label={T.sessionsClose} onClick={() => setSessionsOpen(false)} />
      <SessionList
        sessions={p.sessions}
        currentId={sessionId}
        runningId={p.live ? sessionId : null}
        hasMore={p.sessionsHasMore}
        loadMore={p.loadMoreSessions}
        onPick={(id) => {
          setSessionsOpen(false);
          p.onPickSession(id);
        }}
        onNew={() => {
          setSessionsOpen(false);
          p.onNew();
        }}
      />
      <div className="cm">
        <ChatHeader
          title={p.session?.title ?? ""}
          titleKey={sessionId}
          model={model}
          effort={effort}
          meta={p.meta}
          large={p.large}
          popOpen={popOpen}
          onTitle={p.onTitle}
          onToggleSessions={() => setSessionsOpen((o) => !o)}
          onTogglePop={() => {
            setPopOpen((o) => !o);
            setChanged(false);
          }}
          onToggleLarge={p.onToggleLarge}
          onMinimize={p.onMinimize}
        />
        <Meters session={p.session} meta={p.meta} limits={p.limits} state={state} />
        {p.connection !== "open" && (
          <div className="banner" data-kind={p.connection === "lost" ? "lost" : "back"} role="status">
            {p.connection === "lost" && <span className="spin" />}
            {p.connection === "lost" ? T.lost : T.back}
          </div>
        )}
        {setupError ? (
          <div className="thread">
            <div className="err"><span>{setupError}</span></div>
          </div>
        ) : (
          <Thread
            sessionId={sessionId}
            messages={p.messages}
            hasMore={p.hasMore}
            loading={p.loading}
            loadOlder={p.loadOlder}
            onRetrySend={p.onRetrySend}
            onRetryReply={p.onRetryReply}
          />
        )}
        <StatusLine live={p.live} />
        <Composer
          key={sessionId ?? "new"}
          sessionId={sessionId}
          running={!!p.live}
          disabled={!!setupError}
          maxChars={p.meta?.limits.maxBodyChars ?? 0}
          meta={p.meta}
          dragging={dragging}
          apiRef={composer}
          weekDanger={state.weekDanger}
          inputRef={p.inputRef}
          onSend={p.onSend}
          onStop={p.onStop}
        />
      </div>
      {popOpen && (
        <div className="pop" role="dialog" aria-label={T.modelPopover}>
          <div className="group">
            <label>{T.model}</label>
            <div className="cseg" role="radiogroup">
              {p.meta?.models.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={m.id === model} onClick={() => pick({ model: m.id })}>{m.label}</button>
              ))}
            </div>
          </div>
          <div className="group">
            <label>{T.effort}</label>
            <div className="cseg" role="radiogroup">
              {p.meta?.efforts.map((e) => (
                <button key={e.id} type="button" role="radio" aria-checked={e.id === effort} onClick={() => pick({ effort: e.id })}>{e.label}</button>
              ))}
            </div>
          </div>
          {changed && p.session && <div className="hint">{T.settingsHint}</div>}
        </div>
      )}
    </section>
  );
}
