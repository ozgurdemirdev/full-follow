import { useEffect, useState } from "react";
import { T } from "../../lib/chatText";
import type { Live } from "../../lib/useThread";

const TICK_MS = 1_000;

/** Seconds since `since`, ticking while a reply runs */
export function useElapsed(since: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [since]);
  return since === null ? 0 : Math.max(0, Math.floor((now - since) / TICK_MS));
}

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
