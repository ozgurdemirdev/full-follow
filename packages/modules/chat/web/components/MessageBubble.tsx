import { Children, isValidElement, memo, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseTools, type ChatMessage } from "../api";
import { fmtDay } from "@kit/lib/format";
import { KIND_LABEL, T } from "../messages";
import { STROKE } from "../constants";
import { chatApi } from "../api";
import { Attachment } from "./Attachment";
import { extractSuggest, splitOpenFence } from "../chatReply";
import { CardsSkeleton, RecordCards } from "./RecordCards";
import { SuggestRow } from "./SuggestRow";
import { Icon } from "@kit/components/icons";

const timeFmt = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

function stamp(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString() ? timeFmt.format(d) : `${fmtDay(iso)} ${timeFmt.format(d)}`;
}

const FF = /language-(ff-[a-z]+)/;
const ffLang = (node: unknown) => (isValidElement<{ className?: string }>(node) ? FF.exec(node.props.className ?? "")?.[1] : undefined);

/** Raw HTML stays off (react-markdown default): never dangerouslySetInnerHTML. ```ff-cards renders as record cards, ```ff-suggest renders elsewhere (under the user's message). */
function Reply({ body, caret, messageId }: { body: string; caret: boolean; messageId: number }) {
  const components = useMemo(() => ({
    a: (p: React.ComponentProps<"a">) => <a {...p} target="_blank" rel="noreferrer" />,
    pre: ({ children }: { children?: React.ReactNode }) => (ffLang(Children.toArray(children)[0]) ? <>{children}</> : <pre>{children}</pre>),
    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
      const lang = FF.exec(className ?? "")?.[1];
      if (lang === "ff-cards") return <RecordCards source={String(children)} messageId={messageId} />;
      if (lang === "ff-suggest") return null;
      return <code className={className}>{children}</code>;
    },
  }), [messageId]);
  const { text, open } = caret ? splitOpenFence(body) : { text: body, open: false };
  return (
    <div className="md" data-caret={caret && !open ? "" : undefined}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>{text}</Markdown>
      {open && <CardsSkeleton />}
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
        <Icon name="chevron" className="size-icon-sm" stroke={STROKE.thin} />
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
  onOpenRecord: (type: string, id: number) => void;
  /** the reply that follows this user message, if any: its ack puts a thumbs up here, its ff-suggest block renders here */
  next?: ChatMessage;
}

export const MessageBubble = memo(function MessageBubble({ message: m, onRetrySend, onRetryReply, onOpenRecord, next }: Props) {
  if (m.role === "user") {
    const acked = !!next?.ack && !!m.body;
    const suggest = next?.ack ? extractSuggest(next.body).suggest : null;
    return (
      <article className="msg me" data-pending={m.local === "sending" ? "" : undefined}>
        {!!m.attachments?.length && (
          <div className="matts">
            {m.attachments.map((a) => (
              <Attachment key={a.id} name={a.name} size={a.size} mime={a.mime} url={a.url ?? (a.mime.startsWith("image/") ? chatApi.attachmentUrl(a.id) : undefined)} openUrl={() => chatApi.attachmentUrl(a.id)} />
            ))}
          </div>
        )}
        {m.body && (
          <div className="bubble-wrap">
            <div className="bubble">{m.body}</div>
            {acked && <span className="creact" role="img" aria-label={T.acked}>👍</span>}
          </div>
        )}
        {m.local === "failed" ? (
          <div className="err">
            <span>{T.failed}</span>
            <button type="button" onClick={() => onRetrySend(m)}>{T.retry}</button>
          </div>
        ) : (
          <time>{m.local === "sending" ? T.sending : stamp(m.created_at)}</time>
        )}
        {suggest && next && <SuggestRow suggest={suggest} messageId={next.id} />}
      </article>
    );
  }
  const active = m.state === "pending" || m.state === "streaming";
  const text = extractSuggest(m.body).text;
  // an acknowledgement with no text and no tools is only the thumbs up on the user message: no bubble at all
  if (m.ack && !text.trim() && !parseTools(m).length && m.state !== "error") return null;
  return (
    <article className={`msg${m.ack ? " short" : ""}`}>
      <div className="cwho-row">
        <span className="cwho">{T.claude}</span>
        <time>{stamp(m.created_at)}</time>
      </div>
      {(text || active) && <Reply body={text} caret={active} messageId={m.id} />}
      {!active && <Tools message={m} />}
      {!active && parseTools(m).filter((t) => t.open).map((t, i) => (
        <button key={i} type="button" className="rchip" onClick={() => onOpenRecord(t.open!.type, t.open!.id)}>
          {T.openChip(KIND_LABEL[t.open!.type] ?? t.open!.type, t.open!.id)}
        </button>
      ))}
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
