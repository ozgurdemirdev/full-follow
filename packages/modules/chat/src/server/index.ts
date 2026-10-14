import type { Provider } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatHub } from "./chat-hub";
import { ClaudeRunner } from "./claude-runner";

/** The chat module's NestJS controllers and providers (the event hub and the Claude runner, which starts and stops with the server); the server mounts them through its generated module list */
export const controllers = [ChatController];
export const providers: Provider[] = [ChatHub, ClaudeRunner];
