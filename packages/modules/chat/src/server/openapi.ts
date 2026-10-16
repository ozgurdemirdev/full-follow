import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { chatMessageCreate, chatMessagesQuery, chatSessionCreate, chatSessionsQuery, chatSessionUpdate, draftRunCreate, permissionAnswer } from "../service/schemas";

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
    description: "Answers 202 at once; the reply arrives on the event stream (`/api/chat/sessions/{id}/stream`). Other answers: 409 (code `busy`) while the previous reply is still running, 429 (code `too_many_runs`) when too many chats run at once, 503 (code `cli_missing`) when the Claude CLI is not installed.",
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
  "POST /api/chat/sessions/:id/stop": { summary: "Stop the running answer", description: "A confirmation it left open is cancelled.", params: session, response: ok },
  "GET /api/chat/sessions/:id/permissions": {
    summary: "List the confirmations Claude asked for in a session",
    description: "Before deleting a record, entering a payment, changing a setting or changing an existing file, the panel Claude asks the owner (unless the setting `chat_full_access` is on). Each row has the tool, a Turkish `summary` of what will happen, the reply it belongs to (`message_id`) and its `state`: pending, allowed, denied, expired (no answer within two minutes) or cancelled (the reply ended first). New and settled rows also arrive on the session's event stream as `permission` events. The newest 50, oldest first.",
    params: session,
    response: z.object({ rows: z.array(object) }),
  },
  "POST /api/chat/permissions/:id": {
    summary: "Answer a confirmation",
    description: "`allow: true` lets the tool run, `false` refuses it and Claude is told. Owner only; a confirmation that is no longer pending is refused.",
    params: { id: "Confirmation id" },
    body: permissionAnswer,
    response: object,
  },
  "POST /api/draft-runs": {
    summary: "Ask Claude for a draft now",
    description: "With auto drafting on (setting `draft_auto`) the request is queued and a background Claude run writes one draft on its own chat session (kind `draft`), with only the read tools and `draft`; the answer is `{ mode: \"run\", run }`. A second request with the same title and record returns the run already queued or running. With auto drafting off, no Claude CLI or no drafts module it becomes Claude's task for today: `{ mode: \"task\", task, effects }`. A full queue answers 409.",
    body: draftRunCreate,
    response: object,
  },
  "GET /api/draft-runs": {
    summary: "List the draft requests the buttons show",
    description: "Queued and running requests, and finished ones whose draft still waits for approval (up to 50, newest first).",
    response: z.object({ rows: z.array(object) }),
  },
  "GET /api/draft-runs/:id": { summary: "Get a draft request", description: "Its state, the draft it saved or why it failed.", params: { id: "Draft request id" }, response: object },
  "GET /api/draft-runs/stream": {
    summary: "Follow the draft requests as server-sent events",
    description: "A `run` event with the row on every state change (queued, running, done with `draft_id`, failed with `error`). Reconnect with `Last-Event-ID` (or `last_event_id`) to replay what was missed; when it cannot be replayed a `snapshot` event arrives.",
    query: z.object({ last_event_id: positiveInt.optional().describe("Resume after this event sequence") }),
    contentType: "text/event-stream",
  },
  "GET /api/chat/sessions/:id/stream": {
    summary: "Follow a session as server-sent events",
    description: "Closing the connection only unsubscribes, a run goes on. Reconnect with `Last-Event-ID` (or `last_event_id`) to replay what was missed; when it cannot be replayed a `snapshot` event arrives.",
    params: session,
    query: z.object({ last_event_id: positiveInt.optional().describe("Resume after this event sequence") }),
    contentType: "text/event-stream",
  },
});
