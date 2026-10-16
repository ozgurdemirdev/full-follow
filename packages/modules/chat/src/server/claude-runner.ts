import type { ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { HttpException, Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { APP_TOKEN, ownerName, type ChatSession, type Core } from "@fullfollow/core";
import { LOG_RAW_CHARS } from "../constants";
import { m } from "../messages";
import { ChatHub } from "./chat-hub";
import { attachmentBlocks } from "./chat-uploads";
import { notesVersion, readBrief, writeRuntimeFiles } from "./chat-files";
import { CHAT_ERROR_TEXT, CHAT_LIMITS, CHAT_MODELS, ACK_MARKER, GRACEFUL_EXIT_MS, NOTES_CLEARED, NOTES_UPDATE, VOICE_NOTE, STDERR_LOG_CHARS, type ChatErrorCode } from "./chat.config";
import { killTree, resolveCli, spawnClaude } from "./claude-cli";
import { createParser, errorCode, type ChatEvent, type ToolRecord } from "./stream-parser";

/** Error with an app code (busy, too_many_runs, cli_missing); the ErrorFilter turns it into { error, code } */
export class ChatError extends HttpException {
  constructor(code: ChatErrorCode, status: number) {
    super({ message: CHAT_ERROR_TEXT[code], code }, status);
  }
}

interface Turn {
  messageId: number;
  parser: ReturnType<typeof createParser>;
  /** chars of the reply so far (flushed + pending); the offset of the next delta */
  bodyLen: number;
  pending: string;
  flushTimer?: NodeJS.Timeout;
  timeoutTimer: NodeJS.Timeout;
  tools: ToolRecord[];
  ended: boolean;
  /** first characters held back until it is clear whether the reply starts with the ack marker */
  head: string;
  headDone: boolean;
  ack: boolean;
  /** whitespace after the marker is dropped from the first delivered text */
  stripLead?: boolean;
}

interface Slot {
  sessionId: number;
  child: ChildProcess;
  model: string;
  effort: string;
  stale: boolean;
  turn: Turn | null;
  idleTimer?: NodeJS.Timeout;
  lastUsed: number;
  stderr: string;
}

/** One CLI process per active session. A run belongs to the server, never to an HTTP request. */
@Injectable()
export class ClaudeRunner implements OnModuleInit, OnModuleDestroy {
  private slots = new Map<number, Slot>();
  /** the owner's name, the pinned notes and the private brief as last written to system.md, and all of it together (the version and the hidden update block follow it) */
  private owner: string | null = null;
  private pinned = "";
  private brief = "";
  private notes = "";

  constructor(@Inject(APP_TOKEN) private core: Core, @Inject(ChatHub) private hub: ChatHub) {}

  private get chat() {
    return this.core.mod("chat")!;
  }

  onModuleInit() {
    this.owner = ownerName(this.core.ctx);
    this.pinned = this.core.settings.all().chat_pinned_notes;
    this.brief = readBrief();
    this.notes = this.combined();
    writeRuntimeFiles(this.owner, this.pinned, this.brief);
    const n = this.chat.failDanglingRuns(CHAT_ERROR_TEXT.restart);
    if (n) console.log(m.log.danglingFailed(n));
  }

  onModuleDestroy() {
    for (const s of this.slots.values()) killTree(s.child);
    this.slots.clear();
  }

  runningMessageId(sessionId: number): number | null {
    return this.slots.get(sessionId)?.turn?.messageId ?? null;
  }

  /** The rules are part of it: a resumed CLI session keeps its first system prompt, so changed rules reach it as the hidden update block too */
  private combined = () => [m.systemRules(this.owner), this.pinned.trim(), this.brief.trim()].filter(Boolean).join("\n\n");

  /** A name given in Settings, pinned notes saved there or a changed brief file: rewrite system.md and let every process pick them up on its next message */
  private syncNotes() {
    const owner = ownerName(this.core.ctx);
    const pinned = this.core.settings.all().chat_pinned_notes;
    const brief = readBrief();
    if (owner === this.owner && pinned === this.pinned && brief === this.brief) return;
    this.owner = owner;
    this.pinned = pinned;
    this.brief = brief;
    this.notes = this.combined();
    writeRuntimeFiles(owner, pinned, brief);
    this.markAllStale();
  }

  /** Every live process picks up changed settings on its next message */
  markAllStale() {
    for (const s of this.slots.values()) s.stale = true;
  }

  send(sessionId: number, input: { body: string; client_id: string; attachment_ids?: number[]; input_mode?: string }) {
    const chat = this.chat;
    const prior = chat.findSend(sessionId, input.client_id);
    if (prior) return { user_message: prior.user, assistant_message: prior.reply };
    this.syncNotes();
    const target = resolveCli();
    if (!target) throw new ChatError("cli_missing", 503);
    const session = chat.getSession(sessionId);
    let slot = this.slots.get(sessionId);
    if (slot?.turn) throw new ChatError("busy", 409);
    if (slot && (slot.stale || slot.model !== session.model || slot.effort !== session.effort)) {
      this.slots.delete(sessionId);
      killTree(slot.child);
      slot = undefined;
    }
    if (!slot) this.makeRoom(sessionId);

    const user = chat.addUserMessage(sessionId, input);
    const assistant = chat.startAssistantMessage(sessionId);
    this.hub.emit(sessionId, "session", chat.getSession(sessionId));
    this.hub.emit(sessionId, "status", { message_id: assistant.id, state: "queued" });
    if (!slot) slot = this.spawn(sessionId, session);
    clearTimeout(slot.idleTimer);
    slot.turn = this.newTurn(slot, assistant.id);
    const content = [...(user.body ? [{ type: "text", text: user.body }] : []), ...attachmentBlocks(this.core, user.id), ...this.notesBlock(session), ...(user.input_mode === "voice" ? [{ type: "text", text: VOICE_NOTE }] : [])];
    const line = JSON.stringify({ type: "user", message: { role: "user", content } });
    slot.child.stdin?.write(`${line}\n`);
    return { user_message: user, assistant_message: assistant };
  }

  /**
   * A resumed CLI session keeps its original system prompt, so changed pinned notes reach it as one extra hidden block
   * in its next user message. A chat that has not started yet gets the notes through system.md, so it only records the version.
   */
  private notesBlock(session: ChatSession): { type: "text"; text: string }[] {
    const v = notesVersion(this.notes);
    if (session.notes_version === v) return [];
    this.chat.setNotesVersion(session.id, v);
    if (!session.cli_started) return [];
    return [{ type: "text", text: v ? NOTES_UPDATE + this.notes.trim() : NOTES_CLEARED }];
  }

  /** Stop: the text so far stays, the message becomes `stopped` */
  stop(sessionId: number) {
    const slot = this.slots.get(sessionId);
    if (!slot?.turn) return;
    this.finishTurn(slot, { state: "stopped" });
    this.dropSlot(slot);
  }

  private makeRoom(sessionId: number) {
    const others = [...this.slots.values()].filter((s) => s.sessionId !== sessionId);
    if (others.length < CHAT_LIMITS.maxActiveProcesses) return;
    const idle = others.filter((s) => !s.turn).sort((a, b) => a.lastUsed - b.lastUsed)[0];
    if (!idle) throw new ChatError("too_many_runs", 429);
    this.endGracefully(idle);
  }

  private spawn(sessionId: number, session: ChatSession): Slot {
    const child = spawnClaude(resolveCli()!, session);
    const slot: Slot = { sessionId, child, model: session.model, effort: session.effort, stale: false, turn: null, lastUsed: Date.now(), stderr: "" };
    this.slots.set(sessionId, slot);
    createInterface({ input: child.stdout! }).on("line", (l) => this.onLine(slot, l));
    child.stderr?.on("data", (d) => (slot.stderr = (slot.stderr + d).slice(-STDERR_LOG_CHARS)));
    const failed = (e: Error) => {
      slot.stderr += String(e);
      this.onExit(slot);
    };
    child.on("error", failed);
    // EPIPE when the process died before a write: end the turn as cli_crash instead of an unhandled stream error
    child.stdin?.on("error", failed);
    child.on("exit", () => this.onExit(slot));
    return slot;
  }

  private newTurn(slot: Slot, messageId: number): Turn {
    const turn: Turn = {
      messageId, parser: createParser(), bodyLen: 0, pending: "", tools: [], ended: false, head: "", headDone: false, ack: false,
      timeoutTimer: setTimeout(() => {
        this.finishTurn(slot, { state: "error", code: "timeout" });
        this.dropSlot(slot);
      }, CHAT_LIMITS.runTimeoutMs),
    };
    return turn;
  }

  private onLine(slot: Slot, line: string) {
    const turn = slot.turn;
    if (!line.trim() || !turn) return;
    for (const e of turn.parser.feed(line)) this.onEvent(slot, turn, e);
  }

  private onEvent(slot: Slot, turn: Turn, e: ChatEvent) {
    const { sessionId } = slot;
    const message_id = turn.messageId;
    switch (e.type) {
      case "ready":
        if (!e.mcp_ok) console.warn(m.log.mcpDown);
        this.chat.markCliStarted(sessionId);
        break;
      case "status":
        this.hub.emit(sessionId, "status", { message_id, state: e.state, tool: e.tool });
        break;
      case "delta":
        this.appendText(sessionId, turn, e.text);
        break;
      case "navigate":
        this.hub.emit(sessionId, "navigate", { message_id, type: e.record_type, id: e.record_id, at: Date.now() });
        break;
      case "tools":
        turn.tools = e.tools;
        this.chat.setAssistantTools(message_id, e.tools);
        break;
      case "limits":
        this.hub.limits = { five_hour: e.five_hour, seven_day: e.seven_day, five_resets_at: e.five_resets_at, seven_resets_at: e.seven_resets_at, status: e.status, at: new Date().toISOString() };
        this.hub.emit(sessionId, "limits", this.hub.limits);
        break;
      case "done":
        if (e.fallback_text) this.appendText(sessionId, turn, e.fallback_text);
        this.finishTurn(slot, { state: "done", usage: e.usage, cost_usd: e.cost_usd, context_tokens: e.context_tokens });
        break;
      case "error": {
        const code = errorCode(e.raw);
        console.warn(m.log.cliError(code, e.raw.slice(0, LOG_RAW_CHARS)));
        this.finishTurn(slot, { state: "error", code });
        this.dropSlot(slot);
        break;
      }
    }
  }

  /**
   * Reply text goes through here. The first ACK_MARKER.length characters are held until it is clear whether the reply
   * starts with the marker; the marker is removed from deltas and body and remembered as `ack`.
   */
  private appendText(sessionId: number, turn: Turn, text: string) {
    if (turn.headDone) return this.deliver(sessionId, turn, text);
    turn.head += text;
    if (turn.head.length < ACK_MARKER.length && ACK_MARKER.startsWith(turn.head)) return;
    this.releaseHead(sessionId, turn);
  }

  private releaseHead(sessionId: number, turn: Turn) {
    if (turn.headDone) return;
    turn.headDone = true;
    let rest = turn.head;
    turn.head = "";
    if (rest.startsWith(ACK_MARKER)) {
      turn.ack = true;
      rest = rest.slice(ACK_MARKER.length).trimStart();
      this.hub.emit(sessionId, "ack", { message_id: turn.messageId });
      // text right after the marker starts on a clean line
      turn.stripLead = true;
    }
    if (rest) this.deliver(sessionId, turn, rest);
  }

  private deliver(sessionId: number, turn: Turn, text: string) {
    if (turn.stripLead) {
      text = text.trimStart();
      if (!text) return;
      turn.stripLead = false;
    }
    this.hub.emit(sessionId, "delta", { message_id: turn.messageId, offset: turn.bodyLen, text });
    turn.bodyLen += text.length;
    turn.pending += text;
    turn.flushTimer ??= setTimeout(() => this.flush(turn), CHAT_LIMITS.textFlushMs);
  }

  private flush(turn: Turn) {
    clearTimeout(turn.flushTimer);
    turn.flushTimer = undefined;
    if (!turn.pending) return;
    this.chat.appendAssistantText(turn.messageId, turn.pending);
    turn.pending = "";
  }

  /** Ends the turn once: flush text, write the final row and totals, tell subscribers */
  private finishTurn(slot: Slot, r: { state: "done" | "error" | "stopped"; code?: ChatErrorCode; usage?: { input_tokens: number; output_tokens: number }; cost_usd?: number; context_tokens?: number }) {
    const turn = slot.turn;
    if (!turn || turn.ended) return;
    turn.ended = true;
    clearTimeout(turn.timeoutTimer);
    this.releaseHead(slot.sessionId, turn);
    this.flush(turn);
    const chat = this.chat;
    const row = chat.finishAssistantMessage(turn.messageId, {
      state: r.state, ack: turn.ack, error: r.code ? CHAT_ERROR_TEXT[r.code] : null, usage: r.usage, cost_usd: r.cost_usd, context_tokens: r.context_tokens,
    });
    slot.turn = null;
    slot.lastUsed = Date.now();
    this.hub.emit(slot.sessionId, "message", row);
    const s = chat.getSession(slot.sessionId);
    const limit = CHAT_MODELS.find((model) => model.id === s.model)?.context ?? 0;
    this.hub.emit(slot.sessionId, "usage", {
      context_tokens: s.context_tokens, context_limit: limit, input_tokens_total: s.input_tokens_total,
      output_tokens_total: s.output_tokens_total, cost_usd_micros_total: s.cost_usd_micros_total,
    });
    if (this.slots.get(slot.sessionId) === slot && r.state === "done") {
      slot.idleTimer = setTimeout(() => this.endGracefully(slot), CHAT_LIMITS.idleKillMs);
      slot.idleTimer.unref();
    }
  }

  private onExit(slot: Slot) {
    if (slot.turn) {
      console.warn(m.log.cliClosed(slot.stderr.slice(-STDERR_LOG_CHARS)));
      this.finishTurn(slot, { state: "error", code: "cli_crash" });
    }
    clearTimeout(slot.idleTimer);
    if (this.slots.get(slot.sessionId) === slot) this.slots.delete(slot.sessionId);
  }

  private dropSlot(slot: Slot) {
    if (this.slots.get(slot.sessionId) === slot) this.slots.delete(slot.sessionId);
    clearTimeout(slot.idleTimer);
    killTree(slot.child);
  }

  /** Idle process: close stdin, kill if it has not exited in time */
  private endGracefully(slot: Slot) {
    if (this.slots.get(slot.sessionId) === slot) this.slots.delete(slot.sessionId);
    clearTimeout(slot.idleTimer);
    slot.child.stdin?.end();
    setTimeout(() => killTree(slot.child), GRACEFUL_EXIT_MS).unref();
  }
}
