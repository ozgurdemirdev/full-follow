import type { Actor } from "../../lib/labels";
import { ago } from "../../lib/format";
import { useOwner } from "../../lib/owner";
import { comments as msg } from "../../messages.comments";

/** One message of a thread: avatar and a bubble (the owner's neutral, Claude's warm), with who and when above the text */
export function Bubble({ by, text, at }: { by: Actor; text: string; at: string }) {
  const claude = by === "claude";
  const owner = useOwner();
  return (
    <div className="cmt-msg">
      <span className={`cmt-av ${claude ? "bg-claude-bg text-claude-soft" : "bg-surface-track text-text-primary"}`} aria-hidden="true">{claude ? msg.claudeInitials : owner.initials}</span>
      <div className={`cmt-bubble ${claude ? "bg-comments-claude-bubble" : "bg-surface-2"}`}>
        <span className="text-sm text-text-muted">{claude ? msg.bubble.claude : msg.bubble.you} · {ago(at)}</span>
        <span className="whitespace-pre-line text-base leading-normal text-text-body">{text}</span>
      </div>
    </div>
  );
}
