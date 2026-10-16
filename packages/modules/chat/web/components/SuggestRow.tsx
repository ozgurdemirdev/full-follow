import { useState } from "react";
import { run } from "@kit/api/actions";
import type { Suggest } from "../chatReply";
import { chatPrefs } from "@kit/lib/chatStore";
import { T } from "../messages";

/** Two buttons under the owner's message after "hallettim": the label and "Gerek yok". Only task_done exists; it calls the task endpoint directly, not Claude. */
export function SuggestRow({ suggest, messageId }: { suggest: Suggest; messageId: number }) {
  const [state, setState] = useState(() => chatPrefs.suggest(messageId));
  const [busy, setBusy] = useState(false);
  if (state === "no") return null;
  if (state === "done") return <div className="sugrow"><span className="sugdone">{T.suggestDone(suggest.id)}</span></div>;
  const yes = async () => {
    setBusy(true);
    try {
      await run("patch", `/tasks/${suggest.id}`, { done: true }, { silent: true });
      chatPrefs.setSuggest(messageId, "done");
      setState("done");
    } catch {
      /* stays as it is, the buttons remain */
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sugrow">
      <button type="button" disabled={busy} onClick={() => void yes()}>{suggest.label}</button>
      <button
        type="button"
        onClick={() => {
          chatPrefs.setSuggest(messageId, "no");
          setState("no");
        }}
      >
        {T.suggestNo}
      </button>
    </div>
  );
}
