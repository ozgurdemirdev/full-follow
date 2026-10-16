import type { Provider } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatHub } from "./chat-hub";
import { ClaudeRunner } from "./claude-runner";
import { DraftQueue } from "./draft-queue";
import { DraftRunsController } from "./draft-runs.controller";
import { PermissionWatch } from "./permission-watch";

/**
 * The chat module's NestJS controllers and providers (the event hub, the watch that brings the confirmations to the chat window, the
 * Claude runner, which starts and stops with the server, and the draft queue that runs on it); the server mounts them through its
 * generated module list
 */
export const controllers = [ChatController, DraftRunsController];
export const providers: Provider[] = [ChatHub, PermissionWatch, ClaudeRunner, DraftQueue];
export { docs } from "./openapi";
