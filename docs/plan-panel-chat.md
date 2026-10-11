# Plan: AI chat inside the Full Follow panel

Status: approved direction 2026-10-11, not started. Written so that a Sonnet 5.5 or
Haiku 5.5 session can implement it without asking. Every rule here is a requirement;
anything not listed is out of scope. The session may start in `C:/Projects/Networking`,
but all work happens in the repo `C:/Projects/WebProjects/FullFollow` (use absolute paths,
run git and npm there). Read that repo's `CLAUDE.md` first: its golden rules
(core is the only gate to the database, `created_by` from the entry point, events in
core, tokens only in the web UI) apply on top of this plan.

## 1. Goal

Özgür chats with Claude from the Full Follow web panel. Claude can read and write Full
Follow data through the existing `full-follow` MCP tools. It runs on Özgür's own Claude
subscription through the local Claude Code CLI (`claude -p`), not the Anthropic API.
Single user, local machine only.

Must have:

1. Answers stream token by token. The user always sees what is happening (sent,
   thinking, which tool runs, writing, done, error, stopped).
2. Model switch (Opus 5.5, Sonnet 5.5, Haiku 5.5) and effort switch (low, medium,
   high) per session.
3. New session button; old sessions stay listed and can be continued with their full
   context.
4. F5, a closed tab or a dropped connection never loses anything. Coming back shows
   the full history, including a reply that is still being written, and the stream
   continues where it left off.
5. Live context indicator (tokens used / context window) and per session token and
   cost totals.
6. Stop button for a running reply.

Out of scope (do not build): Anthropic API path, file uploads, images, voice, multi
user, sharing, markdown export, editing past messages, branching.

## 2. Architecture

```
web (React)                      server (NestJS)                       claude CLI
-----------                      ---------------                       ----------
ChatPage ── POST /api/chat/... ─▶ ChatController ──▶ core.chat (SQLite)
   ▲                                   │
   │  SSE /api/chat/sessions/:id/stream│
   └──────────── ChatHub (per session event bus + ring buffer) ◀── ClaudeRunner
                                                                   (one child process
                                                                    per active session,
                                                                    stdin/stdout NDJSON)
                                                                         │
                                                                         ▼
                                                                full-follow MCP (stdio)
```

- **core** owns the two new tables and every read and write to them (`core.chat.*`).
  The server never touches SQLite directly.
- **ClaudeRunner** (server) owns child processes. A run is owned by the server, never
  by an HTTP request: a browser disconnect does not stop a run.
- **ChatHub** (server) fans run events out to any number of SSE subscribers and keeps a
  ring buffer so a reconnecting client can replay what it missed.
- **web** sends with plain `POST` and listens with one `EventSource` per open session.

### Why SSE and not WebSocket

Traffic is one way during a reply (server to browser). The browser to server direction
is a handful of POSTs (send, stop, rename). SSE gives automatic reconnect and
`Last-Event-ID` resume for free in `EventSource`, uses the existing cookie auth and the
existing Express adapter, and needs no new dependency. Do not add `socket.io` or `ws`.

## 3. Prerequisite and smoke test (do this first, before writing code)

1. `claude auth status` must report a logged in account. On 2026-10-11 the CLI's
   OAuth session was expired and every headless run returned the text
   `Failed to authenticate: OAuth session expired and could not be refreshed` with
   `is_error: true`. Fix with `claude auth login`. The app must handle this case (see
   §8, error mapping), not assume it never happens.
2. Run once by hand and save the output to a scratch file (not in the repo):

   ```
   claude -p "Full Follow'da bugün ne var" --output-format stream-json --verbose
     --include-partial-messages --model claude-haiku-5-5
     --strict-mcp-config --mcp-config <generated file, see §6.3>
     --allowedTools mcp__full-follow
   ```

3. Confirm the event shapes in §6.4 against that file. If a field name differs, the
   file wins: update §6.4 in this plan and the parser together. Also send a second
   message through `--input-format stream-json` and confirm the input line shape in
   §6.5.

Verified on 2026-10-11 (CLI 2.1.284, Pro account, `claude-haiku-5-5`, the argv of
§6.3 minus the system prompt file, two stdin lines):

- Line types seen: `system` (subtypes `init`, `status`, `thinking_tokens`,
  `post_turn_summary`; `hook_started` and `hook_response` only without
  `--setting-sources project`), `stream_event`, `assistant`, `user`,
  `rate_limit_event`, `result`.
- `system/init`: `session_id`, `model`, `mcp_servers: [{name: "full-follow", status:
  "connected"}]`. Check `status === "connected"`; otherwise map to `cli_crash` with a
  server log line "full-follow MCP bağlanamadı".
- `stream_event.event.type` values: `message_start` (has `message.usage`),
  `content_block_start` (`content_block.type` = `thinking`, `text`, `tool_use` with
  `name`), `content_block_delta` (`delta.type` = `thinking_delta`, `signature_delta`,
  `text_delta` with `text`, `input_json_delta`), `content_block_stop`, `message_delta`
  (has `usage` and `delta.stop_reason`), `message_stop`. Thinking text is empty
  (`thinking_display: "updates"`), so show only the "Düşünüyor…" state, never thinking
  text.
- Tool names arrive prefixed: `mcp__full-follow__find`. The CLI also calls its own
  `ToolSearch` first to load the deferred MCP tools; treat it as an internal step with
  the label "Araçlar hazırlanıyor".
- `rate_limit_event.rate_limit_info`: `status` (`allowed`, `allowed_warning`, ...),
  `unifiedWindows.five_hour.utilization`, `unifiedWindows.seven_day.utilization`
  (0 to 1), `resetsAt` (unix seconds). The subscription limit IS readable; see §9.
- `result`: `subtype`, `is_error`, `result` (final text), `num_turns`,
  `total_cost_usd`, `usage` (`input_tokens`, `cache_read_input_tokens`,
  `cache_creation_input_tokens`, `output_tokens`), `stop_reason`, `session_id`.
- Two stdin lines written back to back were merged into ONE turn (one `result`; the
  second message was read mid turn). So write the next user line only after the
  previous `result` arrived; §6.5 already enforces one turn at a time.
- stderr printed `[claude-code:unrecognized_model] {"model":"claude-haiku-5-5"}` but the
  run used that model. Log stderr, do not treat this line as an error.
- Cost reference: a new session spends about 35k tokens on the system prompt and tool
  definitions; the first Haiku turn reported `total_cost_usd` 0.32 (API equivalent).
- The alias `--model haiku` resolved to `claude-haiku-4-5`, so **always pass full
  model ids**, never aliases.
- Account: the global CLI login is Özgür's Pro account (`claude auth status` →
  `subscriptionType: "pro"`). Optional env `FF_CLAUDE_CONFIG_DIR`: when set, the runner
  passes `CLAUDE_CONFIG_DIR=<that dir>` in the child env so the panel can use a
  different account than the terminal (log in once with
  `CLAUDE_CONFIG_DIR=<dir> claude auth login`).

## 4. Data model (core)

New migration `packages/core/src/db/migrations/0012_chat.sql`, generated with
`npm run db:generate` after editing `schema.ts`. Use the existing `common()` helper
(id, created_at, updated_at, created_by) and `deletedAt()` exactly like other tables.

`chat_sessions`

| column | type | rule |
|---|---|---|
| ...common() | | |
| ...deletedAt() | | soft delete, goes to trash like other records |
| title | text not null | default `"Yeni sohbet"`; auto set from the first user message (first 60 chars, trimmed at a word boundary) unless the user renamed it |
| title_locked | integer (bool) not null default 0 | 1 after a manual rename |
| cli_session_id | text not null unique | UUID v4 generated by core on create, passed to the CLI as `--session-id` on the first run and `--resume` afterwards |
| cli_started | integer (bool) not null default 0 | 0 until the first run produced `system/init`; decides `--session-id` vs `--resume` |
| model | text not null | one of `CHAT_MODELS` ids (§5) |
| effort | text not null | one of `CHAT_EFFORTS` (§5) |
| context_tokens | integer not null default 0 | last known context size (§9) |
| input_tokens_total | integer not null default 0 | sum over runs |
| output_tokens_total | integer not null default 0 | sum over runs |
| cost_usd_micros_total | integer not null default 0 | `total_cost_usd` × 1,000,000, integer |
| last_message_at | text | ISO, for ordering the list |

Index: `(deleted_at, last_message_at desc)`.

`chat_messages`

| column | type | rule |
|---|---|---|
| ...common() | | `created_by` = `ozgur` for user rows, `claude` for assistant rows |
| session_id | integer not null → chat_sessions.id | |
| role | text enum `user`, `assistant` | |
| body | text not null default `""` | assistant body grows while streaming (§7.3) |
| state | text enum `pending`, `streaming`, `done`, `error`, `stopped` | user rows are `done` immediately |
| client_id | text | UUID from the browser, user rows only; unique per session (idempotent send) |
| tools_json | text | JSON array `[{name, summary, ok}]` of tool calls made in this reply |
| error | text | Turkish user facing message when `state = error` |
| input_tokens, output_tokens | integer | from `result.usage` |
| cost_usd_micros | integer | |

Indexes: `(session_id, id)`, unique `(session_id, client_id)`.

Core service `packages/core/src/services/chat.ts` (keep it under 300 lines; split
`chatQueries.ts` out if it grows):

- `createSession({model?, effort?})` → row. Defaults from `CHAT_DEFAULTS`.
- `listSessions({cursor?, limit})` → `{items, next_cursor}`. Keyset pagination on
  `(last_message_at, id)` descending, excludes deleted. **Never return all rows.**
- `getSession(id)`.
- `updateSession(id, {title?, model?, effort?})`. A title set here sets
  `title_locked = 1`. Model and effort are validated against the constants.
- `deleteSession(id)` → soft delete, writes an event, appears in trash, restorable.
- `listMessages(sessionId, {before?, limit})` → `{items (oldest to newest), has_more}`.
  Keyset on `id`: newest page first, `before` loads older pages.
- `addUserMessage(sessionId, {body, client_id})` → returns the existing row if
  `client_id` was already used (idempotent), otherwise inserts. Also sets
  `last_message_at` and the auto title.
- `startAssistantMessage(sessionId)` → row with `state = pending`.
- `appendAssistantText(messageId, text)` → `body = body || text`, `state = streaming`.
- `setAssistantTools(messageId, tools)`.
- `finishAssistantMessage(messageId, {state, error?, usage?, cost?, context_tokens?})`
  → updates the message and adds totals to the session in one transaction.
- `markCliStarted(sessionId)`.
- `failDanglingRuns(reason)` → every `pending` or `streaming` assistant row becomes
  `error` with the given Turkish reason. Called once at server boot (§7.5).

Events: only `createSession` and `deleteSession` write to `events`. Messages do not
(they would flood the timeline).

Validation: Zod schemas in `packages/core/src/schemas/chat.ts`; types come from
`z.infer`, no hand written duplicates. Body: trimmed, 1 to `CHAT_LIMITS.maxBodyChars`.

Tests (core only, per repo rule; add to the existing Vitest suite):

1. Same `client_id` twice returns the same row and inserts once.
2. `listMessages` pagination: 45 rows, limit 20 → pages of 20, 20, 5 with correct
   `has_more`, no duplicates or gaps.
3. `finishAssistantMessage` adds usage to the session totals exactly once.
4. `failDanglingRuns` touches only `pending` and `streaming` rows.
5. Auto title stops changing after a manual rename.

## 5. Constants (single home)

Server side: `packages/server/src/chat/chat.config.ts`. Shared ids that the web also
needs (model ids, effort ids, limits) live in core `constants.ts` and are re-exported,
so the web imports them through its API types instead of duplicating them. No literal
from this list may appear anywhere else.

```ts
export const CHAT_MODELS = [
  { id: "claude-opus-5-5",   label: "Opus 5.5",   context: 1_000_000 },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", context: 1_000_000 },
  { id: "claude-haiku-5-5",  label: "Haiku 5.5",  context: 1_000_000 },
] as const;
export const CHAT_EFFORTS = [
  { id: "low", label: "Düşük" }, { id: "medium", label: "Orta" }, { id: "high", label: "Yüksek" },
] as const;
export const CHAT_DEFAULTS = { model: "claude-haiku-5-5", effort: "low" } as const; // Sonnet after review, see §12
export const CHAT_LIMITS = {
  maxBodyChars: 8_000,
  sessionsPageSize: 30,
  messagesPageSize: 30,
  maxActiveProcesses: 2,        // oldest idle process is killed to make room
  idleKillMs: 10 * 60_000,      // idle CLI process lifetime between turns
  runTimeoutMs: 10 * 60_000,    // one reply may not run longer than this
  textFlushMs: 400,             // how often streamed text is written to SQLite
  ringBufferEvents: 2_000,      // per session, for SSE replay
  sseHeartbeatMs: 15_000,
  sseRetryMs: 3_000,
  haikuPriceStepTokens: 100_000, // Haiku 5.5 bills prompts above this at 5x; UI marks it
} as const;
```

Env (documented in `.env.example`): `FF_CLAUDE_CLI` optional absolute path to the
Claude Code `cli.js`; if empty it is resolved as in §6.2. `FF_CHAT_CWD` working
directory of the CLI (§6.1). `FF_CLAUDE_CONFIG_DIR` optional separate Claude account
(§3).

## 6. ClaudeRunner (server)

File layout under `packages/server/src/chat/`:

- `chat.config.ts` constants (§5)
- `claude-cli.ts` resolve the executable, build argv, spawn, kill (≤150 lines)
- `stream-parser.ts` NDJSON line → app events, pure function, no I/O (≤200 lines)
- `claude-runner.ts` process pool, one process per session, turn queue (≤250 lines)
- `chat-hub.ts` per session event bus and ring buffer (≤150 lines)
- `chat.controller.ts` HTTP + SSE routes (≤250 lines)
- `chat.module.ts` or register providers in `app.module.ts` like the existing ones

### 6.1 Security rules (gate, not preference)

- User text **never** goes into argv. It goes only through stdin as JSON (§6.5).
- `spawn` with an argument array and `shell: false`. Never `exec`, never a command
  string, never `shell: true`.
- Model and effort in argv come only from the whitelists in §5, after Zod validation.
- The CLI may use only Full Follow tools: `--strict-mcp-config`, `--mcp-config` with
  only the `full-follow` server, `--allowedTools mcp__full-follow`, and
  `--disallowedTools Bash Edit Write NotebookEdit WebFetch WebSearch Read Glob Grep Task`.
  Verify in the smoke test that a request like "C: diskindeki dosyaları listele" is
  refused or denied.
- Working directory of the CLI process: `FF_CHAT_CWD`, default `C:/Projects/Networking`
  (the marketing and network folder). Its `CLAUDE.md` (goal, lead rules, output rules)
  is then loaded as project memory, so the panel Claude knows the business context
  without a long system prompt. File tools stay disabled, so it can read nothing else
  there. Full Follow's own runtime files (`mcp.json`, `system.md`) live in `data/chat/`
  (create on boot, add `data/chat/` to `.gitignore`). If `FF_CHAT_CWD` does not exist,
  fall back to `data/chat/` and log a warning.
  Pass `--setting-sources project` so user level hooks, plugins and skills from
  `~/.claude` do not run inside panel chats (they emitted `hook_started` noise in the
  smoke test). Verified 2026-10-11: with this flag auth works and no hook events are
  emitted. Keep the `system/hook_*` filter in the parser anyway.

### 6.2 Resolving the executable on Windows

`where claude` returns `C:\Users\ozgur\AppData\Roaming\npm\claude.cmd`, a batch shim.
Node cannot spawn `.cmd` files without a shell, and a shell is forbidden (§6.1). So:

1. If `FF_CLAUDE_CLI` is set, use it.
2. Else read the `.cmd` shim found on `PATH`, extract the `.js` path it calls
   (`...\node_modules\@anthropic-ai\claude-code\cli.js` or similar), and use that.
3. Spawn `process.execPath` (the current Node) with `[cliJs, ...args]`.
4. If nothing resolves, the chat page shows the setup error from §8 instead of failing
   per message. Resolve once at boot and cache.

On macOS or Linux the same code path works: resolve the symlink target of `claude`.

### 6.3 Argv for a run

```
[cliJs,
 "-p",
 "--input-format", "stream-json",
 "--output-format", "stream-json",
 "--verbose",
 "--include-partial-messages",
 "--model", session.model,
 "--effort", session.effort,
 session.cli_started ? "--resume" : "--session-id", session.cli_session_id,
 "--strict-mcp-config",
 "--mcp-config", "<abs path>/data/chat/mcp.json",
 "--allowedTools", "mcp__full-follow",
 "--disallowedTools", "Bash", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch", "Read", "Glob", "Grep", "Task",
 "--setting-sources", "project",
 "--append-system-prompt-file", "<abs path>/data/chat/system.md"]
```

`data/chat/mcp.json` is written at boot:
`{"mcpServers":{"full-follow":{"type":"stdio","command":"<process.execPath>","args":["<abs>/packages/mcp/dist/index.js"],"env":{"FF_DB":"<the server's resolved defaultDbPath()>"}}}}`.
Passing `FF_DB` explicitly guarantees the panel Claude writes to the same database the
server uses, including a test copy (§12).

`data/chat/system.md` is written at boot and whenever the pinned notes change (§10):
fixed Turkish rules (answer in Turkish, short, Full Follow is the source of truth, never
send messages on Özgür's behalf) followed by the pinned notes text.

### 6.4 Parsing output (stream-parser.ts)

Read stdout with `readline`, one JSON object per line. A line that fails `JSON.parse`
is logged to stderr and skipped, never crashes the run. Map:

| CLI line | App event |
|---|---|
| `system` / `init` | `ready` (store that the CLI session exists: `markCliStarted`) |
| `system` / `hook_*`, `status` | ignored |
| `stream_event` with `event.type = content_block_start` and `content_block.type = thinking` | `status {state: "thinking"}` |
| `stream_event` with `content_block_start` and `content_block.type = tool_use` | `status {state: "tool", tool: <name without the mcp__full-follow__ prefix>}` |
| `stream_event` with `content_block_delta` and `delta.type = text_delta` | `delta {text}` and `status {state: "writing"}` once |
| `assistant` (full message) | collect `tool_use` blocks into `tools_json` (name + short input summary, max 80 chars) |
| `user` with `tool_result` blocks | mark the matching tool `ok = !is_error`; `status {state: "thinking"}` |
| `stream_event` with `content_block_start`, `tool_use`, name `ToolSearch` | `status {state: "tool", tool: "Araçlar hazırlanıyor"}` |
| `stream_event` with `message_delta` | update context tokens from its `usage` (§9) |
| `rate_limit_event` | `limits {five_hour, seven_day, resets_at, status}` |
| `system` / `thinking_tokens`, `post_turn_summary` | ignored |
| `result` with `is_error = false` | `done {usage, total_cost_usd}` |
| `result` with `is_error = true` | `error {raw: result}` → mapped in §8 |

Do not take the reply text from the `assistant` message or from `result.result`; the
deltas are the single source, otherwise text is duplicated. Exception: if a turn
produced zero deltas and `result.result` is non-empty and not an error, use it as the
body (covers the case where partial messages are not emitted).

### 6.5 Sending a turn (stdin)

One process stays alive per active session and receives turns on stdin, one JSON line
per user message (shape to confirm in the smoke test):

```json
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]}}
```

Write with `stdin.write(JSON.stringify(obj) + "\n")`. Only one turn runs at a time per
session: a send while a reply is running returns HTTP 409 `{code: "busy"}` and the UI
prevents it anyway.

### 6.6 Process lifecycle

- Spawn lazily on the first message of a session after server start.
- Keep the process for `idleKillMs` after the last `result`; then end it gracefully
  (close stdin, wait 2 s, then kill). The next message respawns with `--resume`, so
  context survives.
- Model or effort change: applies from the next message. Mark the process as stale;
  when the next message arrives, end the stale process and spawn a new one with
  `--resume` and the new flags. Never kill a process mid reply because of a settings
  change.
- `maxActiveProcesses`: when exceeded, end the least recently used idle process. If all
  are busy, the send returns 429 `{code: "too_many_runs"}` with the Turkish message from
  §8.
- Stop: on POST stop, send the kill; mark the message `stopped` keeping the text so
  far. On Windows `child.kill()` does not kill grandchildren (the MCP server), so kill
  the tree: `execFile("taskkill", ["/pid", String(pid), "/T", "/F"])`. Elsewhere use a
  process group (`detached: true` and `process.kill(-pid)`).
- `runTimeoutMs` exceeded: same as stop, state `error`, message from §8.
- Process exits before `result`: state `error`, include the last 500 chars of stderr in
  the server log (never in the UI).
- Server shutdown (`SIGINT`, `SIGTERM`, Nest `onModuleDestroy`): kill every process
  tree.

## 7. Transport and reconnect (the F5 requirement)

### 7.1 HTTP routes (all under the existing auth guard)

| Method and path | Body / query | Response |
|---|---|---|
| `GET /api/chat/meta` | | `{models, efforts, limits, cli_ok, cli_error?}` |
| `GET /api/chat/sessions` | `cursor?`, `limit?` (≤ sessionsPageSize) | `{items, next_cursor}` |
| `POST /api/chat/sessions` | `{model?, effort?}` | session |
| `PATCH /api/chat/sessions/:id` | `{title?, model?, effort?}` | session |
| `DELETE /api/chat/sessions/:id` | | `{ok: true}` |
| `GET /api/chat/sessions/:id/messages` | `before?`, `limit?` (≤ messagesPageSize) | `{items, has_more, running_message_id, stream_seq}` |
| `POST /api/chat/sessions/:id/messages` | `{body, client_id}` | 202 `{user_message, assistant_message}` |
| `POST /api/chat/sessions/:id/stop` | | `{ok: true}` |
| `GET /api/chat/sessions/:id/stream` | header `Last-Event-ID?` | `text/event-stream` |

Every body and query is validated with the core Zod schemas at the controller boundary,
mapped to the existing error shape `{error, code}` through the existing `ErrorFilter`.
Set an explicit JSON body limit for these routes (64 kB is enough).

### 7.2 SSE endpoint rules

- Headers: `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache,
  no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`. Call
  `res.flushHeaders()` immediately. Make sure no compression middleware touches this
  route (the existing `precompressed` middleware only serves static files; keep it that
  way).
- First write: `retry: <sseRetryMs>\n\n`.
- Every event: `id: <seq>\nevent: <name>\ndata: <json>\n\n`. `seq` is a per session
  integer that increases by one for every event and never resets while the server runs.
- Heartbeat: `: ping\n\n` every `sseHeartbeatMs`.
- On connect with `Last-Event-ID = n`: if the ring buffer still holds `n + 1`, replay
  `n + 1 ...` in order, then go live. If not (buffer overflowed or server restarted),
  send one `event: snapshot` and the client refetches messages.
- On `req.on("close")`: unsubscribe and clear the heartbeat timer. **Do not stop the
  run.**
- Event names and payloads (the full contract; nothing else is sent):

| event | data |
|---|---|
| `status` | `{message_id, state: "queued"|"thinking"|"tool"|"writing", tool?}` |
| `delta` | `{message_id, offset, text}` (offset rule in §7.3) |
| `message` | full assistant message row after finish (`done`, `error`, `stopped`) |
| `usage` | `{context_tokens, context_limit, input_tokens_total, output_tokens_total, cost_usd_micros_total}` |
| `session` | session row after a rename, auto title or settings change |
| `limits` | `{five_hour, seven_day, resets_at, status}` from `rate_limit_event`; the hub also keeps the latest value globally and `GET /api/chat/meta` returns it |
| `snapshot` | `{}` |

### 7.3 Persistence while streaming

- Deltas are buffered in memory and flushed to SQLite with
  `appendAssistantText` every `textFlushMs` and once more on finish. So after F5 the
  message list already contains the text written up to the last flush.
- `GET messages` returns `running_message_id` (or null) and `stream_seq` = the hub's
  current seq for that session. The client opens the stream with that seq as
  `Last-Event-ID`; replay covers the gap between the last flush and the live stream.
  Deltas that the client already has in the flushed body must not be applied twice:
  each `delta` carries `offset` = the body length before this delta; the client applies
  a delta only if `offset == local body length`, ignores it if smaller, and refetches if
  larger.

### 7.4 Client side reconnect

- One `EventSource` per open session, created in a hook `useChatStream(sessionId)`.
  Use the browser's built in reconnect; do not write a manual retry loop.
- Track the last received `id` in a ref; `EventSource` sends it automatically on
  reconnect. After F5 the first connection gets it from `GET messages` instead: build
  the URL `.../stream?last_event_id=<stream_seq>` and have the server accept either the
  header or that query parameter (the header wins).
- On `snapshot`: refetch the newest messages page, keep scroll position.
- Show a small connection badge when `readyState` is `CONNECTING` for more than 2 s:
  "Bağlantı koptu, yeniden bağlanıyor…". Hide it on `open`.
- Sending: the client generates `client_id` (`crypto.randomUUID()`), shows the user
  bubble at once with state "gönderiliyor", and POSTs. On network failure the bubble
  shows "Gönderilemedi" with "Tekrar dene", which POSTs again with the same `client_id`
  (the server dedupes).
- The composer draft is saved per session in `localStorage` (key from the existing
  `api/keys.ts` pattern), wrapped in try/catch, cleared after a successful send. F5
  keeps an unsent draft.
- The open session id lives in the URL (`/chat/:id`), so F5 reopens the same session.

### 7.5 Server restart

At boot call `core.chat.failDanglingRuns("Sunucu yeniden başladı, bu cevap yarım kaldı.")`.
The CLI keeps its own session files on disk, so the next message in that session runs
with `--resume` and the conversation context is intact.

## 8. Errors and Turkish UI strings

All user facing strings live in one file `packages/web/src/lib/chatText.ts`. Server
error codes map to them; the server never sends free text that the UI renders as is,
except `message.error` which is one of the strings below chosen by code.

| code | when | text |
|---|---|---|
| `cli_missing` | executable not resolved | "Claude Code bulunamadı. Terminalde `npm i -g @anthropic-ai/claude-code` çalıştır." |
| `cli_auth` | `result.is_error` and text contains "authenticate" | "Claude oturumu kapanmış. Terminalde `claude auth login` çalıştır, sonra tekrar dene." |
| `cli_limit` | text mentions usage or rate limit | "Claude kullanım sınırına takıldın. Sınır yenilenince tekrar dene." |
| `cli_crash` | exit before result | "Claude beklenmedik şekilde kapandı. Tekrar dene." |
| `timeout` | runTimeoutMs | "Cevap çok uzun sürdü ve durduruldu." |
| `busy` | send during a run | "Önceki cevap bitmeden yeni mesaj gönderilemez." |
| `too_many_runs` | pool full | "Aynı anda çok fazla sohbet çalışıyor, birinin bitmesini bekle." |
| `restart` | §7.5 | "Sunucu yeniden başladı, bu cevap yarım kaldı." |
| `unknown` | any other `is_error` | "Bir hata oldu. Tekrar dene." |

Status labels: queued "Gönderildi", thinking "Düşünüyor…", tool "Full Follow'da
çalışıyor: {tool}", writing "Yazıyor…", stopped "Durduruldu". Buttons: "Gönder",
"Durdur", "Yeni sohbet", "Daha eski mesajlar", "Tekrar dene". Empty state: "Bir şey
sor: bugün kime yazmalıyım, şu firmanın durumu ne, bu haftanın raporu…".

## 9. Context and usage indicator

- `context_tokens` = from the last `assistant` message's `usage` in the turn:
  `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`. Fall back to
  `result.usage` with the same formula. Store on the session, send as `usage` event.
- Bar in the chat header: `context_tokens / model.context`, label "Bağlam: 42 bin /
  1 milyon" (format with the existing number formatter in `lib/format.ts`).
- When the model is Haiku 5.5 and `context_tokens > haikuPriceStepTokens`, the bar
  turns to the warning token colour and shows "100 binin üstü: Haiku pahalılaştı, yeni
  sohbet önerilir".
- Totals tooltip: input, output tokens and "API karşılığı: $0,42" from
  `cost_usd_micros_total`. This is the equivalent API price the CLI reports, not money
  spent.
- Subscription usage: from the latest `limits` event, two small meters in the header:
  "5 saat: %3" and "Haftalık: %84", with the reset time on hover ("Yenilenme: Pzt
  12:00"). At `status = allowed_warning` or seven_day ≥ 0.75 the weekly meter uses the
  warning token colour; at ≥ 0.95 the composer shows "Haftalık sınıra çok yakınsın".
  Before the first run of the day the meters show the last stored value with its time,
  never a made up number.
- The CLI compacts long sessions on its own; no compaction code in Full Follow.

## 10. Pinned context

Settings page gets a "Sohbet sabit notları" textarea (existing settings service,
key `chat_pinned_notes`, max 4,000 chars). Saving rewrites `data/chat/system.md` and
marks all live processes stale (§6.6), so the next message uses the new notes.

## 11. Web UI

Files under `packages/web/src/`:

- `pages/Chat.tsx` page shell (≤250 lines)
- `components/chat/SessionList.tsx`, `Thread.tsx`, `MessageBubble.tsx`,
  `Composer.tsx`, `ChatHeader.tsx`, `ContextBar.tsx`, `StatusLine.tsx`
- `api/chat.ts` typed calls on top of the existing `api` client
- `lib/useChatStream.ts` the EventSource hook (§7.4)
- `lib/chatText.ts` strings (§8)

Routing and nav: add `chat` to `routes.ts` loaders and `PATHS`, route
`${PATHS.chat}/:id?`, sidebar entry "Sohbet". Opening `/chat` without id opens the most
recent session or creates one on first send.

Layout: session list on the left (collapsible on mobile into a sheet using the existing
`Sheet` component), thread in the middle, composer pinned to the bottom. Works at phone
width.

Rules:

- Pagination everywhere: session list loads `sessionsPageSize` and more on scroll to the
  end (IntersectionObserver sentinel); thread loads the newest `messagesPageSize` and
  "Daha eski mesajlar" or reaching the top loads older pages. When older messages are
  prepended, keep the visual scroll position (measure `scrollHeight` before and after).
  Never fetch a whole session or the whole list.
- Auto scroll: stick to the bottom only if the user was within 80 px of it (that number
  is a token or a named constant, not a literal); otherwise show a "Yeni mesaj ↓" pill.
- Composer: auto growing textarea, Enter sends, Shift+Enter new line, IME safe
  (ignore Enter while `isComposing`). While a reply runs, the send button becomes
  "Durdur". Character counter appears after 80% of `maxBodyChars`.
- Header: editable title, model select, effort select, context bar, "Yeni sohbet".
  Changing model or effort shows a one line hint "Bir sonraki mesajdan itibaren
  geçerli".
- Assistant text renders markdown with `react-markdown` + `remark-gfm` (new
  dependencies, the only ones this plan adds). Raw HTML stays disabled (the default);
  never use `dangerouslySetInnerHTML`. Links open in a new tab with `rel="noreferrer"`.
- Streaming text: append deltas to state; render with a blinking caret while
  `writing`. Batch state updates with `requestAnimationFrame` so a fast stream does not
  re-render per token.
- Tool calls: a collapsed "N işlem yapıldı" row under the reply; expanded it lists
  tool name, summary and ok or failed.
- Accessibility: status line in an `aria-live="polite"` region; buttons have labels;
  focus returns to the composer after send.
- Styling: only design tokens (`npm run check` enforces it: no hex, px, ms or arbitrary
  Tailwind values in source). Motion through the existing `motion` helpers and
  `MotionScope`, respecting reduced motion.

## 12. Work packets (do them in this order, one commit each)

Rules while implementing and testing (the Pro account's weekly usage was 84% on
2026-10-11, and the real database must stay intact):

- Work on a separate git branch; never push, never merge. Özgür reviews from his main
  Claude session before merging.
- Every test run of the chat uses `claude-haiku-5-5` with effort `low`. During
  development `CHAT_DEFAULTS` stays `{model: "claude-haiku-5-5", effort: "low"}`;
  switching the default to Sonnet is a separate one line commit after review.
- Never test against the real database. First `npm run backup`, then copy
  `data/fullfollow.db` to `data/fullfollow-test.db` and start the server with
  `FF_DB=data/fullfollow-test.db`. The MCP child gets the same path through `mcp.json`.
- Keep test prompts read only ("kaç şablon var", "bugün ne var"). One write test only
  (add a comment to a test record) and only on the test database.
- Do not change existing MCP tools, existing controllers or existing pages except the
  router, sidebar and settings additions this plan names. `npm run build` and `npm test`
  must pass before every commit.

1. **Core**: schema, migration, Zod schemas, `chat.ts` service, constants, 5 tests.
   Done when `npm test` passes.
2. **CLI layer**: `claude-cli.ts` (resolve, argv, spawn, kill tree), `stream-parser.ts`
   with a unit of fixture lines saved from the smoke test under
   `packages/server/test-fixtures/chat-stream.jsonl` (parser checked by a small script,
   not a test suite, per repo rule). Done when a script prints the mapped events for the
   fixture.
3. **Runner + hub + controller**: process pool, turn queue, flush, SSE with replay,
   routes, boot cleanup, shutdown. Done when `curl -N` on the stream shows events for a
   message sent with `curl -X POST`, and killing curl mid reply does not stop the run.
4. **Web**: page, components, hook, strings, routes, sidebar. Done when the manual
   checks in §13 pass.
5. **Settings**: pinned notes field and stale marking.
6. **README**: this is a public project, so the README must let a stranger use the chat.
   Add a "Panel sohbeti" section to `README.md` (Turkish, like the rest of it) covering:
   requirements (Claude Code CLI installed with `npm i -g @anthropic-ai/claude-code`, a
   logged in Claude subscription via `claude auth login`, Node 22+, `npm run build`
   done once so `packages/mcp/dist` exists), what the chat can and cannot do (only Full
   Follow tools, no file or shell access), the env vars `FF_CLAUDE_CLI`, `FF_CHAT_CWD`,
   `FF_CLAUDE_CONFIG_DIR` with defaults (a stranger has no `C:/Projects/Networking`, so
   say the fallback is `data/chat/`), how to open it (sidebar "Sohbet"), the pinned notes
   setting, the common errors from §8 with their fix, and a note that usage counts
   against the user's own Claude plan. Also update `.env.example`, the commands table if
   a script was added, and the "Durum" line.

Commit rules (apply to every packet):

- One commit per packet, made right after its "done when" check passes, on the working
  branch, never skipped or batched at the end. Messages follow the repo history style
  (`feat: ...`, `docs: ...`), imperative, one logical change.
- Packet 1 also adds `data/chat/` to `.gitignore` (runtime files, may hold a copy of the
  pinned notes). Do not commit `data/`.
- Before each commit run `git diff` and `git status` to confirm only the packet's files
  are staged. Never push, never merge (see rules above).

## 13. Manual acceptance checks (Özgür runs these)

1. Send "bugün ne var": status goes Gönderildi → Düşünüyor → Full Follow'da çalışıyor:
   today → Yazıyor, text streams, ends with tokens shown.
2. Press F5 while text is streaming: after reload the partial text is there and keeps
   streaming to the end without duplicated words.
3. Close the tab mid reply, reopen after the reply finished: full reply is there.
4. Turn Wi-Fi off for 10 s mid reply: badge appears, disappears, stream resumes.
5. Stop mid reply: text so far stays, marked "Durduruldu"; next message works.
6. Switch to Haiku 5.5, send: reply comes from Haiku (`init.model` logged); old context
   is remembered ("az önce ne sormuştum").
7. Yeni sohbet: empty thread, old session in the list, opening it shows its history and
   continues with context.
8. Session with 100+ messages: opens fast, older pages load on scroll, position kept.
9. `claude auth logout`, send: the `cli_auth` message appears, no spinner forever.
10. Restart the server mid reply: message shows the `restart` text; next message in the
    same session remembers the earlier conversation.
11. Ask "C: diskindeki dosyaları listele": no file system access happens.
12. `npm run build` passes (includes the token check and type check).

## 14. Known risks

- The CLI output format is not a stable public contract. The parser is isolated in one
  pure file with a fixture so a CLI update is a one file fix.
- `--setting-sources project` behaviour must be confirmed in the smoke test (§6.1).
- `--input-format stream-json` multi turn behaviour must be confirmed in the smoke test;
  if a long lived process does not accept a second turn, fall back to one process per
  turn with `--resume` (slower start, same correctness). The rest of the design does
  not change.
