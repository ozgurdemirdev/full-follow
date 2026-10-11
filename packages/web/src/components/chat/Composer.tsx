import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type RefObject, type Ref } from "react";
import type { ChatMeta } from "../../api/chat";
import { CHAT_UI, T } from "../../lib/chatText";
import { acceptAttr, isImage, refuseReason } from "../../lib/chatFiles";
import { chatPrefs } from "../../lib/chatStore";
import { useDictation } from "../../lib/useDictation";
import { Attachment } from "./Attachment";
import { Icon } from "../icons";

interface Pending {
  key: string;
  file: File;
  /** object URL for the thumbnail of an image */
  url?: string;
}

/** The window hands dropped files to the composer through this */
export interface ComposerApi {
  addFiles: (files: FileList | File[]) => void;
}

interface Props {
  /** draft storage key: the open session id, or null for a chat not created yet */
  sessionId: number | null;
  running: boolean;
  disabled: boolean;
  maxChars: number;
  meta: ChatMeta | null;
  weekDanger: boolean;
  dragging: boolean;
  inputRef: Ref<HTMLTextAreaElement>;
  apiRef: RefObject<ComposerApi | null>;
  /** resolves true when the message was taken (the composer then clears itself) */
  onSend: (text: string, files: File[], mode: "text" | "voice") => Promise<boolean>;
  onStop: () => void;
}

/** Remount with key={sessionId} so the draft of another session loads */
export function Composer({ sessionId, running, disabled, maxChars, meta, weekDanger, dragging, inputRef, apiRef, onSend, onStop }: Props) {
  const [text, setText] = useState(() => chatPrefs.draft(sessionId));
  const [files, setFiles] = useState<Pending[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const voiceUsed = useRef(false);
  const dictation = useDictation((phrase) => {
    voiceUsed.current = true;
    setText((t) => (t && !/\s$/.test(t) ? `${t} ` : t) + phrase.trim());
  });
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  });
  useEffect(() => () => filesRef.current.forEach((f) => f.url && URL.revokeObjectURL(f.url)), []);

  useLayoutEffect(() => {
    const a = area.current;
    if (!a) return;
    a.style.height = "auto";
    a.style.height = `${a.scrollHeight}px`;
  }, [text, files.length]);

  useEffect(() => {
    chatPrefs.setDraft(sessionId, text);
  }, [sessionId, text]);

  const addFiles = (list: FileList | File[]) => {
    if (!meta) return;
    let count = filesRef.current.length;
    const added: Pending[] = [];
    let why: string | null = null;
    for (const file of Array.from(list)) {
      const reason = refuseReason(file, count, meta);
      if (reason) {
        why = reason;
        continue;
      }
      count++;
      added.push({ key: crypto.randomUUID(), file, url: isImage(file) ? URL.createObjectURL(file) : undefined });
    }
    setProblem(why);
    if (added.length) setFiles((f) => [...f, ...added]);
  };
  useEffect(() => {
    apiRef.current = { addFiles };
    return () => {
      apiRef.current = null;
    };
  });

  const remove = (p: Pending) => {
    if (p.url) URL.revokeObjectURL(p.url);
    setFiles((f) => f.filter((x) => x.key !== p.key));
    setProblem(null);
    area.current?.focus();
  };

  const canSend = (!!text.trim() || files.length > 0) && !busy;
  const submit = async () => {
    const body = text.trim();
    if (!canSend || running || disabled) return;
    setBusy(true);
    dictation.stop();
    const taken = await onSend(body, files.map((f) => f.file), voiceUsed.current ? "voice" : "text");
    setBusy(false);
    if (!taken) return;
    files.forEach((f) => f.url && URL.revokeObjectURL(f.url));
    setFiles([]);
    setProblem(null);
    setText("");
    voiceUsed.current = false;
    area.current?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submit();
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!e.clipboardData.files.length) return;
    e.preventDefault();
    addFiles(e.clipboardData.files);
  };
  const setRefs = (node: HTMLTextAreaElement | null) => {
    area.current = node;
    if (typeof inputRef === "function") inputRef(node);
    else if (inputRef) inputRef.current = node;
  };

  // while listening the unfinished phrase shows at the end of the text and is replaced by the next result
  const shown = dictation.interim ? `${text}${text && !/\s$/.test(text) ? " " : ""}${dictation.interim}` : text;
  const showCount = text.length >= maxChars * CHAT_UI.composerCountFrom;
  return (
    <div className="composer-wrap">
      <form
        className="composer"
        data-drag={dragging ? "" : undefined}
        data-listening={dictation.listening ? "" : undefined}
        onSubmit={(e) => {
          e.preventDefault();
          if (running) onStop();
          else void submit();
        }}
      >
        {files.length > 0 && (
          <div className="atts">
            {files.map((p) => (
              <Attachment key={p.key} name={p.file.name} size={p.file.size} mime={p.file.type} url={p.url} onRemove={() => remove(p)} />
            ))}
          </div>
        )}
        {dictation.listening && (
          <div className="voice">
            <span className="wave"><i /><i /><i /><i /><i /></span>
            <span>{T.listening}</span>
            <button className="vstop" type="button" onClick={dictation.stop}>{T.listenDone}</button>
          </div>
        )}
        <div className="crow">
          <button className="ib" type="button" aria-label={T.attach} disabled={disabled} onClick={() => picker.current?.click()}>
            <Icon name="clip" className="size-icon-md" />
          </button>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            accept={acceptAttr(meta)}
            onChange={(e) => {
              addFiles(e.target.files ?? []);
              e.target.value = "";
            }}
          />
          <textarea
            ref={setRefs}
            rows={1}
            maxLength={maxChars}
            value={shown}
            placeholder={T.placeholderFiles}
            aria-label={T.message}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              const next = dictation.interim && v.endsWith(dictation.interim) ? v.slice(0, v.length - dictation.interim.length).trimEnd() : v;
              if (!next.trim()) voiceUsed.current = false;
              setText(next);
            }}
            onKeyDown={onKey}
            onPaste={onPaste}
          />
          {dictation.supported && (
            <button className="ib mic" type="button" aria-label={T.mic} aria-pressed={dictation.listening} disabled={disabled} onClick={dictation.toggle}>
              <Icon name="mic" className="size-icon-md" />
            </button>
          )}
          {running ? (
            <button className="send" type="submit" data-stop="" aria-label={T.stop}>
              <span className="sq" />
              {T.stop}
            </button>
          ) : (
            <button className="send" type="submit" aria-label={T.send} disabled={disabled || !canSend}>
              <Icon name="up" className="size-icon-md" stroke={2} />
            </button>
          )}
        </div>
        {dragging && <div className="drophint">{T.dropHint}</div>}
      </form>
      <div className="cfoot">
        <span className={weekDanger || problem || dictation.error ? "warn" : undefined}>{problem ?? (dictation.error === "denied" ? T.micDenied : dictation.error === "failed" ? T.micFailed : weekDanger ? T.weekNear : T.composerHint)}</span>
        {showCount && <span className="count mono">{T.charCount(text.length, maxChars)}</span>}
      </div>
    </div>
  );
}
