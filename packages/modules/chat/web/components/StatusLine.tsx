import { T } from "../chatText";
import { useElapsed } from "@kit/lib/useElapsed";
import type { Live } from "../useThread";

export { useElapsed };

export function statusText(live: Live): string {
  if (live.phase === "queued") return T.statusQueued;
  if (live.phase === "thinking") return T.statusThinking;
  if (live.phase === "writing") return T.statusWriting;
  return T.statusTool(live.tool ?? "");
}

export function StatusLine({ live }: { live: Live | null }) {
  const secs = useElapsed(live?.since ?? null);
  return (
    <div className="status" aria-live="polite" hidden={!live} data-phase={live?.phase ?? ""}>
      <span className="st-dot" />
      <span className="st-text">{live ? statusText(live) : ""}</span>
      {live && <span className="st-time mono">{T.seconds(secs)}</span>}
    </div>
  );
}
