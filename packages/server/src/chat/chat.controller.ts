import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import { CORE, type Core } from "../core.provider";
import { intId } from "../http";
import { ChatHub } from "./chat-hub";
import { mcpBuilt } from "./chat-files";
import { CHAT_EFFORTS, CHAT_LIMITS, CHAT_MODELS } from "./chat.config";
import { resolveCli } from "./claude-cli";
import { ClaudeRunner } from "./claude-runner";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};
const frame = (e: { seq: number; name: string; data: unknown }) => `id: ${e.seq}\nevent: ${e.name}\ndata: ${JSON.stringify(e.data)}\n\n`;

@Controller("api/chat")
export class ChatController {
  constructor(@Inject(CORE) private core: Core, private runner: ClaudeRunner, private hub: ChatHub) {}

  @Get("meta")
  meta() {
    const cli_error = !resolveCli() ? "cli_missing" : !mcpBuilt() ? "mcp_not_built" : undefined;
    return { models: CHAT_MODELS, efforts: CHAT_EFFORTS, limits: CHAT_LIMITS, cli_ok: !cli_error, cli_error, rate_limits: this.hub.limits };
  }

  @Get("sessions")
  sessions(@Query() q: Record<string, unknown>) {
    return this.core.chat.listSessions(q);
  }

  @Post("sessions")
  create(@Body() b: unknown) {
    return this.core.chat.createSession(b);
  }

  @Patch("sessions/:id")
  update(@Param("id") id: string, @Body() b: unknown) {
    const row = this.core.chat.updateSession(intId(id), b);
    this.hub.emit(row.id, "session", row);
    return row;
  }

  @Delete("sessions/:id")
  remove(@Param("id") id: string) {
    const n = intId(id);
    this.runner.stop(n);
    return this.core.chat.deleteSession(n);
  }

  @Get("sessions/:id/messages")
  messages(@Param("id") id: string, @Query() q: Record<string, unknown>) {
    const n = intId(id);
    return { ...this.core.chat.listMessages(n, q), running_message_id: this.runner.runningMessageId(n), stream_seq: this.hub.seq(n) };
  }

  @Post("sessions/:id/messages")
  @HttpCode(202)
  send(@Param("id") id: string, @Body() b: { body?: string; client_id?: string }) {
    return this.runner.send(intId(id), { body: String(b?.body ?? ""), client_id: String(b?.client_id ?? "") });
  }

  @Post("sessions/:id/stop")
  @HttpCode(200)
  stop(@Param("id") id: string) {
    this.runner.stop(intId(id));
    return { ok: true };
  }

  /** SSE: closing the connection never stops a run, it only unsubscribes */
  @Get("sessions/:id/stream")
  stream(@Param("id") id: string, @Query("last_event_id") qLast: string | undefined, @Req() req: any, @Res() res: any) {
    const n = intId(id);
    this.core.chat.getSession(n);
    res.writeHead(200, SSE_HEADERS);
    res.flushHeaders();
    res.write(`retry: ${CHAT_LIMITS.sseRetryMs}\n\n`);

    const header = req.headers["last-event-id"] ?? qLast;
    const last = header === undefined || header === "" ? null : Number(header);
    const unsubscribe = this.hub.subscribe(n, (e) => res.write(frame(e)));
    if (last !== null && Number.isFinite(last)) {
      const missed = this.hub.replay(n, last);
      if (missed) missed.forEach((e) => res.write(frame(e)));
      else res.write(`event: snapshot\ndata: {}\n\n`);
    }
    const beat = setInterval(() => res.write(": ping\n\n"), CHAT_LIMITS.sseHeartbeatMs);
    req.on("close", () => {
      clearInterval(beat);
      unsubscribe();
    });
  }
}
