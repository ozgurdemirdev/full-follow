import { useState, type FormEvent } from "react";
import { run } from "@kit/api/actions";
import type { Person } from "@kit/api/types";
import { defaultChannel } from "@kit/lib/people";
import { BoardIcon } from "@kit/components/boardIcons";
import { MicButton } from "@kit/components/MicButton";
import { m } from "../messages";
import { m as kit } from "@kit/messages";
import { stroke as STROKE } from "@kit/styles/tokens.json";

export type Mode = "touch" | "note" | "claude";
const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: "touch", label: m.composerModes.touch, hint: m.composerHints.touch },
  { key: "note", label: m.composerModes.note, hint: m.composerHints.note },
  { key: "claude", label: m.composerModes.claude, hint: m.composerHints.claude },
];
const DIRECTIONS = [{ key: "giden", label: m.composerDirections.giden }, { key: "gelen", label: m.composerDirections.gelen }] as const;
const SAVED: Record<Mode, string> = { touch: m.composerSaved.touch, note: m.composerSaved.note, claude: m.common.claudeForwarded };

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
  const hint = MODES.find((x) => x.key === mode)!.hint;

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
      <div className="ppl-modes" role="radiogroup" aria-label={m.composer.whatAdding}>
        {MODES.map((x) => (
          <button key={x.key} type="button" role="radio" className="ppl-mode" aria-checked={mode === x.key} onClick={() => onMode(x.key)}>{x.label}</button>
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
        <button type="submit" className="ff-field-go" aria-label={kit.save} disabled={busy}><BoardIcon name="arrowRight" className="size-icon-chip" stroke={STROKE.bold} /></button>
      </form>
    </div>
  );
}
