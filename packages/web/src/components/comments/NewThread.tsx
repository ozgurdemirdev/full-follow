import { useState, type FormEvent } from "react";
import { run } from "../../api/actions";
import { kindOf, type Target } from "../../lib/comments";
import { BoardIcon } from "../boardIcons";
import { MicButton } from "../MicButton";

const OPENED = "Konu açıldı, Claude MCP’de görüyor";

/** "Yeni konu": pick one of the recent records, write (or dictate) to Claude, the thread opens on that record */
export function NewThread({ targets, onOpened }: { targets: Target[]; onOpened: () => void }) {
  const [key, setKey] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const id = (t: Target) => `${t.type}:${t.id}`;
  const target = targets.find((t) => id(t) === key) ?? targets[0];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await run("post", "/comments", { target_type: target.type, target_id: target.id, body }, { ok: OPENED });
      setText("");
      onOpened();
    } catch {
      /* the toast is shown by run() */
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Yeni konu" className="cmt-new">
      <div className="cmt-targets">
        <span className="cmt-new-label">Yeni konu</span>
        {targets.map((t) => (
          <button key={id(t)} type="button" aria-pressed={t === target} onClick={() => setKey(id(t))}>
            <span className={`size-2 shrink-0 rounded-pill ${kindOf(t.type).dot}`} />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>
      <form className="ff-field cmt-compose" onSubmit={(e) => void submit(e)}>
        <input type="text" value={text} aria-label="Claude’a yaz" placeholder={`${target.label} hakkında Claude’a yaz`} onChange={(e) => setText(e.target.value)} />
        <MicButton onText={(t) => setText((cur) => (cur ? `${cur} ${t}` : t))} />
        <button type="submit" className="ff-field-go" aria-label="Konu aç" disabled={busy}>
          <BoardIcon name="arrowRight" className="size-icon-chip" stroke={2.4} />
        </button>
      </form>
    </section>
  );
}
