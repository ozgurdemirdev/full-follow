import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { recordHref } from "../api/actions";
import { useAskClaude, type AskState, type ClaudeRequest } from "../lib/askClaude";
import { requestChatSession } from "../lib/chatStore";
import { m } from "../messages";

/**
 * A button that asks Claude: idle it shows `label` (with `icon`); asked as a task it shows `askedLabel` and is disabled; while a
 * background run writes the draft it shows the spinner and "Claude yazıyor…", cannot ask again and opens the run in the chat window;
 * once the draft is saved it says "Taslak hazır" and opens the draft. `className` and `attrs` give the screen's own asked look.
 */
export function AskButton({ request, label, askedLabel, icon, className, attrs }: {
  request: ClaudeRequest;
  label: ReactNode;
  askedLabel: string;
  icon?: ReactNode;
  className: string | ((asked: boolean) => string);
  attrs?: (asked: boolean) => Record<string, string | undefined>;
}) {
  const { ask, state } = useAskClaude();
  const [, go] = useLocation();
  const s: AskState = state(request);
  const asked = s.kind === "asked" || s.kind === "writing";
  const cls = typeof className === "string" ? className : className(asked);
  const look = attrs?.(asked);

  if (s.kind === "writing") {
    const sessionId = s.run?.session_id ?? null;
    return (
      <button type="button" className={cls} {...look} data-ask="writing" aria-disabled="true" aria-busy="true" title={m.draftRun.watch}
        onClick={() => sessionId !== null && requestChatSession(sessionId)}>
        <span className="ff-spinner" aria-hidden="true" />
        {m.draftRun.writing}
      </button>
    );
  }
  if (s.kind === "ready") {
    const draftId = s.run.draft_id;
    return (
      <button type="button" className={cls} {...look} data-ask="ready" onClick={() => draftId !== null && go(recordHref("draft", draftId))}>
        {icon}
        {m.draftRun.ready}
      </button>
    );
  }
  return (
    <button type="button" className={cls} {...look} disabled={asked} onClick={() => void ask(request)}>
      {icon}
      {s.kind === "asked" ? askedLabel : label}
    </button>
  );
}
