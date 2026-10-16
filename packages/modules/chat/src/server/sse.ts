import type { Request, Response } from "express";
import { ChatHub } from "./chat-hub";
import { CHAT_LIMITS } from "./chat.config";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};
const frame = (e: { seq: number; name: string; data: unknown }) => `id: ${e.seq}\nevent: ${e.name}\ndata: ${JSON.stringify(e.data)}\n\n`;

/**
 * One hub channel as server-sent events: replays what a reconnecting client missed (Last-Event-ID or `last_event_id`), or sends a
 * `snapshot` event when the gap cannot be filled. Closing the connection only unsubscribes.
 */
export function serveChannel(hub: ChatHub, channel: number, qLast: string | undefined, req: Request, res: Response): void {
  res.writeHead(200, SSE_HEADERS);
  res.flushHeaders();
  res.write(`retry: ${CHAT_LIMITS.sseRetryMs}\n\n`);

  const header = req.headers["last-event-id"] ?? qLast;
  const last = header === undefined || header === "" ? null : Number(header);
  const unsubscribe = hub.subscribe(channel, (e) => res.write(frame(e)));
  if (last !== null && Number.isFinite(last)) {
    const missed = hub.replay(channel, last);
    if (missed) missed.forEach((e) => res.write(frame(e)));
    else res.write(`event: snapshot\ndata: {}\n\n`);
  }
  const beat = setInterval(() => res.write(": ping\n\n"), CHAT_LIMITS.sseHeartbeatMs);
  req.on("close", () => {
    clearInterval(beat);
    unsubscribe();
  });
}
