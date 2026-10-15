import { useState, type FormEvent } from "react";
import { run } from "@kit/api/actions";
import type { Person } from "@kit/api/types";
import { defaultChannel } from "@kit/lib/people";
import { BoardIcon } from "@kit/components/boardIcons";
import { MicButton } from "@kit/components/MicButton";

export type Mode = "touch" | "note" | "claude";
const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "touch", label: "Temas", hint: "Ne konuştunuz? Örn. aradım, cuma dönecek" },
  { key: "note", label: "Not", hint: "Kendine not: ne seviyor, neye dikkat" },
  { key: "claude", label: "Claude’a", hint: "Claude bu kişiyle ilgili ne yapsın?" },
];
const DIRECTIONS = [{ key: "giden", label: "Ben yazdım" }, { key: "gelen", label: "O yazdı" }] as const;
const SAVED: Record<Mode, string> = { touch: "Temas kaydedildi", note: "Not eklendi", claude: "Claude’a iletildi, cevabı burada görünecek" };

/** Add to the stream: a touch (with its direction), a note, or a comment for Claude (a reply when a thread is picked) */
export function Composer({ person, mode, onMode, replyTo, onSent }: {
  person: Person;
  mode: Mode;
  onMode: (m: Mode) => void;
  /** thread the next Claude comment answers */
  replyTo: number | null;
  onSent: () => void;
}) {
  const [direction, setDirection] = useState<(typeof DIRECTIONS)[number]["key"]>("giden");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const hint = MODES.find((m) => m.key === mode)!.hint;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      if (mode === "touch") await run("post", "/touches", { person_id: person.id, channel: defaultChannel(person), direction, summary: body }, { ok: SAVED.touch });
      else if (mode === "note") await run("post", "/notes", { person_id: person.id, body }, { ok: SAVED.note });
      else await run("post", "/comments", replyTo ? { reply_to: replyTo, body } : { target_type: "person", target_id: person.id, body }, { ok: SAVED.claude });
      setText("");
      onSent();
    } catch {
      /* the toast is shown by run() */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ppl-panel is-compact">
      <div className="ppl-modes" role="radiogroup" aria-label="Ne ekliyorsun">
        {MODES.map((m) => (
          <button key={m.key} type="button" role="radio" className="ppl-mode" aria-checked={mode === m.key} onClick={() => onMode(m.key)}>{m.label}</button>
        ))}
        {mode === "touch" ? (
          <>
            <span className="flex-grow" />
            {DIRECTIONS.map((d) => (
              <button key={d.key} type="button" role="radio" className="ppl-dirpill" aria-checked={direction === d.key} onClick={() => setDirection(d.key)}>{d.label}</button>
            ))}
          </>
        ) : null}
      </div>
      <form className="ff-field" onSubmit={(e) => void submit(e)}>
        <input type="text" value={text} aria-label={hint} placeholder={hint} onChange={(e) => setText(e.target.value)} />
        <MicButton onText={(t) => setText((cur) => (cur ? `${cur} ${t}` : t))} />
        <button type="submit" className="ff-field-go" aria-label="Kaydet" disabled={busy}><BoardIcon name="arrowRight" className="size-icon-chip" stroke={2.4} /></button>
      </form>
    </div>
  );
}
