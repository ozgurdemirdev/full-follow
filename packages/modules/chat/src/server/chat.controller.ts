import { Body, BadRequestException, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import fs from "node:fs";
import { pipeline } from "node:stream";
import type { Request, Response } from "express";
import { APP_TOKEN, type Core } from "@fullfollow/core";
import { intId, parse } from "@fullfollow/core";
import { permissionAnswer } from "../service/schemas";
import { PERMISSION_LIMITS } from "../constants";
import { m } from "../messages";
import { ChatHub } from "./chat-hub";
import { mcpBuilt } from "./chat-files";
import { cardRecords } from "./chat-records";
import { attachmentFile, saveUpload } from "./chat-uploads";
import { CHAT_ATTACHMENT_TYPES, CHAT_DEFAULTS, CHAT_EFFORTS, CHAT_LIMITS, CHAT_MODELS } from "./chat.config";
import { resolveCli } from "./claude-cli";
import { ClaudeRunner } from "./claude-runner";
import { PermissionWatch } from "./permission-watch";
import { serveChannel } from "./sse";

@Controller("api/chat")
export class ChatController {
  constructor(
    @Inject(APP_TOKEN) private core: Core,
    @Inject(ClaudeRunner) private runner: ClaudeRunner,
    @Inject(ChatHub) private hub: ChatHub,
    @Inject(PermissionWatch) private permissions: PermissionWatch,
  ) {}

  private get chat() {
    return this.core.mod("chat")!;
  }

  @Get("meta")
  meta() {
    const cli_error = !resolveCli() ? "cli_missing" : !mcpBuilt() ? "mcp_not_built" : undefined;
    return { models: CHAT_MODELS, efforts: CHAT_EFFORTS, defaults: CHAT_DEFAULTS, attachment_types: CHAT_ATTACHMENT_TYPES, limits: CHAT_LIMITS, cli_ok: !cli_error, cli_error, rate_limits: this.hub.limits, permission_timeout_ms: PERMISSION_LIMITS.timeoutMs };
  }

  /** Live rows for the record cards of a reply: ?keys=task:7,person:12,template:5@12 (max 30) */
  @Get("records")
  records(@Query("keys") keys?: string) {
    return cardRecords(this.core, keys ?? "");
  }

  @Get("sessions")
  sessions(@Query() q: Record<string, unknown>) {
    return this.chat.listSessions(q);
  }

  @Get("sessions/:id")
  one(@Param("id") id: string) {
    return this.chat.getSession(intId(id));
  }

  @Post("sessions")
  create(@Body() b: unknown) {
    return this.chat.createSession(b);
  }

  @Patch("sessions/:id")
  update(@Param("id") id: string, @Body() b: unknown) {
    const row = this.chat.updateSession(intId(id), b);
    this.hub.emit(row.id, "session", row);
    return row;
  }

  @Delete("sessions/:id")
  remove(@Param("id") id: string) {
    const n = intId(id);
    this.runner.stop(n);
    return this.chat.deleteSession(n);
  }

  @Get("sessions/:id/messages")
  messages(@Param("id") id: string, @Query() q: Record<string, unknown>) {
    const n = intId(id);
    return { ...this.chat.listMessages(n, q), running_message_id: this.runner.runningMessageId(n), stream_seq: this.hub.seq(n) };
  }

  @Post("sessions/:id/messages")
  @HttpCode(202)
  send(@Param("id") id: string, @Body() b: { body?: string; client_id?: string; attachment_ids?: number[]; input_mode?: string }) {
    return this.runner.send(intId(id), { body: String(b?.body ?? ""), client_id: String(b?.client_id ?? ""), attachment_ids: b?.attachment_ids, input_mode: b?.input_mode });
  }

  /** multipart, field "file": stored on disk, becomes part of a message when its id is sent in attachment_ids */
  @Post("sessions/:id/attachments")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: CHAT_LIMITS.maxFileBytes } }))
  upload(@Param("id") id: string, @UploadedFile() file: { originalname: string; buffer: Buffer; size: number } | undefined) {
    if (!file) throw new BadRequestException(m.errors.fileRequired);
    return saveUpload(this.core, intId(id), file);
  }

  /** Thumbnails and downloads; stored mime only, never sniffed by the browser */
  @Get("attachments/:id")
  attachment(@Param("id") id: string, @Res() res: Response) {
    const a = attachmentFile(this.core, intId(id));
    // text files show as plain text in the tab (markdown and csv would download otherwise); images and PDF show as they are
    res.setHeader("Content-Type", a.mime.startsWith("text/") ? "text/plain; charset=utf-8" : a.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(a.name)}`);
    // pipeline destroys the file stream when the response closes early, so an aborted download never holds the file handle
    pipeline(fs.createReadStream(a.path), res, () => {});
  }

  /** The confirmations of a session, newest kept, oldest first: the cards of the chat window */
  @Get("sessions/:id/permissions")
  sessionPermissions(@Param("id") id: string) {
    const n = intId(id);
    this.chat.getSession(n);
    return { rows: this.chat.permissions.ofSession(n) };
  }

  /** The owner's answer to a confirmation: { allow: true } runs the tool, false refuses it */
  @Post("permissions/:id")
  @HttpCode(200)
  answer(@Param("id") id: string, @Body() b: unknown) {
    const { allow } = parse(permissionAnswer, b);
    return this.permissions.answer(intId(id), allow);
  }

  @Post("sessions/:id/stop")
  @HttpCode(200)
  stop(@Param("id") id: string) {
    this.runner.stop(intId(id));
    return { ok: true };
  }

  /** SSE: closing the connection never stops a run, it only unsubscribes */
  @Get("sessions/:id/stream")
  stream(@Param("id") id: string, @Query("last_event_id") qLast: string | undefined, @Req() req: Request, @Res() res: Response) {
    const n = intId(id);
    this.chat.getSession(n);
    serveChannel(this.hub, n, qLast, req, res);
  }
}
