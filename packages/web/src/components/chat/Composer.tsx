import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { CHAT_UI, T } from "../../lib/chatText";
import { chatPrefs } from "../../lib/chatStore";
import { Icon } from "../icons";

interface Props {
  /** draft storage key: the open session id, or null for a chat not created yet */
  sessionId: number | null;
  running: boolean;
  disabled: boolean;
  maxChars: number;
  weekDanger: boolean;
  inputRef: Ref<HTMLTextAreaElement>;
  onSend: (text: string) => void;
  onStop: () => void;
}

/** Remount with key={sessionId} so the draft of another session loads */
export function Composer({ sessionId, running, disabled, maxChars, weekDanger, inputRef, onSend, onStop }: Props) {
  const [text, setText] = useState(() => chatPrefs.draft(sessionId));
  const area = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = "auto";
    a.style.height = `${a.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    chatPrefs.setDraft(sessionId, text);
  }, [sessionId, text]);

  const submit = () => {
    const body = text.trim();
    if (!body || running || disabled) return;
    onSend(body);
    setText("");
    area.current?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    submit();
  };
  const setRefs = (node: HTMLTextAreaElement | null) => {
    area.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) inputRef.current = node;
  };

  const showCount = text.length >= maxChars * CHAT_UI.composerCountFrom;
  return (
    <div className="composer-wrap">
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (running) onStop();
          else submit();
        }}
      >
        <div className="crow">
          <textarea
            ref={setRefs}
            rows={1}
            maxLength={maxChars}
            value={text}
            placeholder={T.placeholder}
            aria-label={T.message}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
          />
          {running ? (
            <button className="send" type="submit" data-stop="" aria-label={T.stop}>
              <span className="sq" />
              {T.stop}
            </button>
          ) : (
            <button className="send" type="submit" aria-label={T.send} disabled={disabled || !text.trim()}>
              <Icon name="up" className="size-icon-md" stroke={2} />
            </button>
          )}
        </div>
      </form>
      <div className="cfoot">
        <span className={weekDanger ? "warn" : undefined}>{weekDanger ? T.weekNear : T.composerHint}</span>
        {showCount && <span className="count mono">{T.charCount(text.length, maxChars)}</span>}
      </div>
    </div>
  );
}
