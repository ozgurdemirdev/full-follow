import { memo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseTools, type ChatMessage } from "../../api/chat";
import { fmtDay } from "../../lib/format";
import { T } from "../../lib/chatText";
import { Icon } from "../icons";

const timeFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

function stamp(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? timeFmt.format(d) : `${fmtDay(iso)} ${timeFmt.format(d)}`;
}

const components = { a: (p: React.ComponentProps<"a">) => <a {...p} target="_blank" rel="noreferrer" /> };

/** Raw HTML stays off (react-markdown default): never dangerouslySetInnerHTML */
function Reply({ body, caret }: { body: string; caret: boolean }) {
  return (
    <div className="md" data-caret={caret ? "" : undefined}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>{body}</Markdown>
    </div>
  );
}

function Tools({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false);
  const tools = parseTools(message);
  if (!tools.length) return null;
  return (
    <>
      <button type="button" className="tools" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="chevron" className="size-icon-sm" stroke={1.8} />
        {T.toolsDone(tools.length)}
      </button>
      {open && (
        <ul className="tool-list">
          {tools.map((t, i) => (
            <li key={i}>
              <code>{t.name}</code>
              <span>{t.summary}</span>
              <b className={t.ok ? "ok" : "bad"}>{t.ok ? T.toolOk : T.toolFailed}</b>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface Props {
  message: ChatMessage;
  /** resend this user message with the same client id (failed send) */
  onRetrySend: (m: ChatMessage) => void;
  /** ask again after a failed reply */
  onRetryReply: () => void;
}

export const MessageBubble = memo(function MessageBubble({ message: m, onRetrySend, onRetryReply }: Props) {
  if (m.role === "user") {
    return (
      <article className="msg me" data-pending={m.local === "sending" ? "" : undefined}>
        <div className="bubble">{m.body}</div>
        {m.local === "failed" ? (
          <div className="err">
            <span>{T.failed}</span>
            <button type="button" onClick={() => onRetrySend(m)}>{T.retry}</button>
          </div>
        ) : (
          <time>{m.local === "sending" ? T.sending : stamp(m.created_at)}</time>
        )}
      </article>
    );
  }
  const active = m.state === "pending" || m.state === "streaming";
  return (
    <article className="msg">
      <div className="who-row">
        <span className="who">Claude</span>
        <time>{stamp(m.created_at)}</time>
      </div>
      {(m.body || active) && <Reply body={m.body} caret={active} />}
      {!active && <Tools message={m} />}
      {m.state === "stopped" && (
        <div className="endnote">
          <span className="chip c-neutral">{T.stopped}</span>
        </div>
      )}
      {m.state === "error" && (
        <div className="err">
          <span>{m.error}</span>
          <button type="button" onClick={onRetryReply}>{T.retry}</button>
        </div>
      )}
    </article>
  );
});
