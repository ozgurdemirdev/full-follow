import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { APP_TOKEN, type ChatPermission, type Core } from "@fullfollow/core";
import { PERMISSION_LIMITS } from "../constants";
import { ChatHub } from "./chat-hub";

/**
 * Brings the confirmations the MCP host of a chat writes to the chat window: the host is another process and only shares the
 * database, so while a panel reply runs the server reads the pending rows every watchPollMs and sends each new or settled one as a
 * `permission` event on its session's stream. The timer runs only while a reply runs or a card it showed is still open.
 */
@Injectable()
export class PermissionWatch implements OnModuleInit, OnModuleDestroy {
  /** sessions with a running panel reply */
  private running = new Set<number>();
  /** pending rows already shown: id to session */
  private shown = new Map<number, number>();
  private timer?: NodeJS.Timeout;

  constructor(@Inject(APP_TOKEN) private core: Core, @Inject(ChatHub) private hub: ChatHub) {}

  private get api() {
    return this.core.mod("chat")!.permissions;
  }

  /** A confirmation left from the last server run can never be answered: its host was stopped with the server */
  onModuleInit() {
    this.api.cancel();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private send(row: ChatPermission) {
    this.hub.emit(row.session_id, "permission", row);
  }

  /** A panel reply started: watch for the confirmations it asks */
  watch(sessionId: number) {
    this.running.add(sessionId);
    this.timer ??= setInterval(() => this.tick(), PERMISSION_LIMITS.watchPollMs);
    this.timer.unref();
  }

  /** The reply ended (done, failed or stopped): a card it left open can no longer be answered */
  unwatch(sessionId: number) {
    this.running.delete(sessionId);
    for (const row of this.api.cancel(sessionId)) {
      this.shown.delete(row.id);
      this.send(row);
    }
    this.tick();
  }

  /** The owner's answer: the card settles at once, the waiting host reads it on its next poll */
  answer(id: number, allow: boolean): ChatPermission {
    const row = this.api.answer(id, allow);
    this.shown.delete(id);
    this.send(row);
    return row;
  }

  private tick() {
    const pending = this.api.pending();
    const ids = new Set(pending.map((r) => r.id));
    for (const row of pending) {
      if (this.shown.has(row.id)) continue;
      this.shown.set(row.id, row.session_id);
      this.send(row);
    }
    // gone from the pending list without an answer here: the host's timeout settled it
    for (const id of [...this.shown.keys()]) {
      if (ids.has(id)) continue;
      this.shown.delete(id);
      this.send(this.api.get(id));
    }
    if (!this.running.size && !this.shown.size) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
