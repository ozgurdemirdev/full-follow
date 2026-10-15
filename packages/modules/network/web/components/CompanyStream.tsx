import { useEffect, useRef, useState, type FormEvent } from "react";
import { remove, run } from "@kit/api/actions";
import type { Company, CompanyCard } from "@kit/api/types";
import { openSheet } from "@kit/app/ui";
import { touchChannel, type StreamItem } from "../stream";
import { ago } from "@kit/lib/format";
import { BoardIcon } from "@kit/components/boardIcons";
import { MicButton } from "@kit/components/MicButton";
import { STREAM_SHOWN } from "@kit/lib/people";
import { resolve, stopWaiting, Tools } from "./Stream";

const HINT = {
  touch: "Firmaya temas ekle: kiminle, ne konuştunuz",
  claude: "Claude bu firmayla ilgili ne yapsın?",
  reply: "Claude’a cevap yaz",
};
const SAVED = { touch: "Temas kaydedildi", claude: "Claude’a iletildi, cevabı burada görünecek" };

/** The field of the board: a touch to the company; "Claude’a" mode (or a reply to a thread) writes a comment for Claude instead */
export function CompanyComposer({ company, card, claude, replyTo, onClaude }: {
  company: Company;
  card?: CompanyCard;
  claude: boolean;
  replyTo: number | null;
  /** switch the mode: true for Claude, false back to touch (also clears the reply) */
  onClaude: (on: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const hint = !claude ? HINT.touch : replyTo ? HINT.reply : HINT.claude;

  useEffect(() => {
    if (claude) input.current?.focus();
  }, [claude, replyTo]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      if (!claude) await run("post", "/touches", { company_id: company.id, channel: touchChannel(card, company), direction: "giden", summary: body }, { ok: SAVED.touch });
      else await run("post", "/comments", replyTo ? { reply_to: replyTo, body } : { target_type: "company", target_id: company.id, body }, { ok: SAVED.claude });
      setText("");
      if (claude) onClaude(false);
    } catch {
      /* the toast is shown by run() */
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {claude ? (
        <div className="co-claude-mode">
          Claude’a yazıyorsun
          <button type="button" className="ppl-small" onClick={() => onClaude(false)}>Vazgeç</button>
        </div>
      ) : null}
      <form className="ff-field" onSubmit={(e) => void submit(e)}>
        <input ref={input} type="text" value={text} aria-label="Firmaya temas ekle" placeholder={hint} onChange={(e) => setText(e.target.value)} />
        <MicButton onText={(t) => setText((cur) => (cur ? `${cur} ${t}` : t))} />
        <button type="submit" className="ff-field-go" aria-label="Kaydet" disabled={busy}><BoardIcon name="arrowRight" className="size-icon-chip" stroke={2.4} /></button>
      </form>
    </>
  );
}

function Entry({ item, pair, lead, onReply }: { item: StreamItem; pair: string; lead: boolean; onReply: (thread: number) => void }) {
  const { touch: t, comment: c, thread: th } = item;
  const openThread = !!th && !th.resolved_at && th.last_id === c?.id;
  return (
    <div className="co-entry">
      <span className={`co-ini ${item.kind === "person" ? pair : ""}`} data-k={item.kind}>{item.ini}</span>
      <div className="flex min-w-0 flex-grow flex-col gap-2">
        <span className="co-who">
          <span>{item.who} · {ago(item.at)}</span>
          {th?.resolved_at ? <span>· Konu kapandı</span> : null}
          {t ? <Tools label="Temas" onEdit={() => openSheet("touch", { edit: t.id })} onDelete={() => void remove(`/touches/${t.id}`, "Temas").catch(() => {})} /> : null}
        </span>
        <span className="co-text">{item.text}</span>
        {lead && t?.direction === "giden" && t.expects_reply ? (
          <span className="flex flex-wrap gap-2"><button type="button" className="ppl-small" onClick={() => void stopWaiting(t.id)}>Cevap beklemiyorum</button></span>
        ) : null}
        {openThread ? (
          <span className="flex flex-wrap gap-2">
            {th!.last_by === "claude" ? <button type="button" className="ppl-small is-accent" onClick={() => onReply(th!.id)}>Cevapla</button> : null}
            <button type="button" className="ppl-small" onClick={() => void resolve(th!.id)}>Konu kapandı</button>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Entries of the company stream: touches to the company and its people, and the threads with Claude */
export function CompanyStream({ items, pair, onReply }: { items: StreamItem[]; pair: string; onReply: (thread: number) => void }) {
  const [all, setAll] = useState(false);
  const list = all ? items : items.slice(0, STREAM_SHOWN);
  const leadKey = items.find((i) => i.touch?.direction === "giden")?.key;
  return (
    <div className="ppl-stream flex flex-col">
      {list.map((i) => <Entry key={i.key} item={i} pair={pair} lead={i.key === leadKey} onReply={onReply} />)}
      {items.length === 0 ? <p className="m-0 border-t border-border-subtle py-6 text-base-sm text-text-muted">Burada henüz kayıt yok.</p> : null}
      {items.length > list.length ? <button type="button" className="btn btn-ghost self-start px-0 text-base-sm" onClick={() => setAll(true)}>{items.length - list.length} kayıt daha</button> : null}
    </div>
  );
}
