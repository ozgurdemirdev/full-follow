import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { chatMessageCreate, chatMessagesQuery, chatSessionCreate, chatSessionsQuery, chatSessionUpdate } from "../service/schemas";

const { defineDocs, object, ok, positiveInt } = docKit;
const session = { id: "Chat session id" };

/** API documentation of the chat routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  "GET /api/chat/meta": {
    summary: "Get the chat settings the panel needs",
    description: "Models, efforts, defaults, attachment types and limits, whether the Claude CLI is usable (`cli_ok`, `cli_error`) and the rate limits.",
    response: object,
  },
  "GET /api/chat/records": {
    summary: "Get live rows for the record cards of a reply",
    description: "Up to 30 keys, for example `task:7,person:12,template:5@12`.",
    query: z.object({ keys: z.string().optional().describe("Comma separated record keys") }),
    response: object,
  },
  "GET /api/chat/sessions": { summary: "List chat sessions, newest first", description: "Cursor paged.", query: chatSessionsQuery, response: object },
  "GET /api/chat/sessions/:id": { summary: "Get a chat session", params: session, response: object },
  "POST /api/chat/sessions": { summary: "Start a chat session", body: chatSessionCreate, response: object },
  "PATCH /api/chat/sessions/:id": { summary: "Rename a session or change its model or effort", params: session, body: chatSessionUpdate, response: object },
  "DELETE /api/chat/sessions/:id": { summary: "Delete a chat session", description: "Stops a running answer first. The session is hidden and can be restored from the trash.", params: session, response: object },
  "GET /api/chat/sessions/:id/messages": {
    summary: "List the messages of a session",
    description: "Newest page first; `before` is a message id. Also tells which message is running and the stream sequence to resume from.",
    params: session,
    query: chatMessagesQuery,
    response: object,
  },
  "POST /api/chat/sessions/:id/messages": {
    summary: "Send a message to Claude",
    description: "Answers 202 at once; the reply arrives on the event stream (`/api/chat/sessions/{id}/stream`).",
    params: session,
    body: chatMessageCreate,
    response: object,
  },
  "POST /api/chat/sessions/:id/attachments": {
    summary: "Upload an attachment",
    description: "The file is stored; it joins a message when its id is sent in `attachment_ids`.",
    params: session,
    multipart: z.object({ file: z.string().meta({ format: "binary" }).describe("The file") }),
    response: object,
  },
  "GET /api/chat/attachments/:id": { summary: "Download an attachment", description: "Served with its stored mime type, never sniffed by the browser.", params: { id: "Attachment id" }, contentType: "application/octet-stream" },
  "POST /api/chat/sessions/:id/stop": { summary: "Stop the running answer", params: session, response: ok },
  "GET /api/chat/sessions/:id/stream": {
    summary: "Follow a session as server-sent events",
    description: "Closing the connection only unsubscribes, a run goes on. Reconnect with `Last-Event-ID` (or `last_event_id`) to replay what was missed; when it cannot be replayed a `snapshot` event arrives.",
    params: session,
    query: z.object({ last_event_id: positiveInt.optional().describe("Resume after this event sequence") }),
    contentType: "text/event-stream",
  },
});
