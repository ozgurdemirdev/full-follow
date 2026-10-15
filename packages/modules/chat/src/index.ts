import { defineModule, rows } from "@fullfollow/core";
import { m } from "./messages";
import { chatService } from "./service/chat";

/**
 * Chat: the panel chat's sessions, messages and attachments. The server side (the Claude CLI runner, the event hub, uploads, record chips)
 * lives in `./server`. Every module takes part through its `chatCards` contribution (what a record chip of a reply shows). Its tables
 * (chat_sessions, chat_messages, chat_attachments) stay in core's schema; removing this package leaves the rows in place.
 */
export default defineModule({
  key: "chat",
  label: m.label,
  smoke: ["/api/chat/meta", "/api/chat/sessions"],
  api: chatService,
  contribute: {
    // a deleted session is hidden in place: the trash lists it and brings it back
    softTrash: {
      type: "chat_session",
      label: m.session,
      list: (ctx) => rows(ctx, "SELECT id, title AS label, deleted_at FROM chat_sessions WHERE deleted_at IS NOT NULL"),
      restore: (ctx, id) => ctx.mod("chat")!.restoreSession(id),
    },
  },
});
