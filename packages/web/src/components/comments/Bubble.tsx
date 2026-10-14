import type { Actor } from "../../lib/labels";
import { ago } from "../../lib/format";

/** One message of a thread: avatar and a bubble (Özgür's neutral, Claude's warm), with who and when above the text */
export function Bubble({ by, text, at }: { by: Actor; text: string; at: string }) {
  const claude = by === "claude";
  return (
    <div className="cmt-msg">
      <span className={`cmt-av ${claude ? "bg-claude-bg text-claude-soft" : "bg-surface-track text-text-primary"}`} aria-hidden="true">{claude ? "CL" : "ÖD"}</span>
      <div className={`cmt-bubble ${claude ? "bg-comments-claude-bubble" : "bg-surface-2"}`}>
        <span className="text-sm text-text-muted">{claude ? "Claude" : "Sen"} · {ago(at)}</span>
        <span className="whitespace-pre-line text-base leading-normal text-text-body">{text}</span>
      </div>
    </div>
  );
}
