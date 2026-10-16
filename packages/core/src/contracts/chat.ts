import type { Actor, Channel, ChatSessionKind, DraftRunState } from "../constants";

/** A panel chat session as stored */
export interface ChatSession {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: Actor;
  deleted_at: string | null;
  title: string;
  /** chat: a conversation in the panel; draft: a background run that writes one draft with the restricted tool set */
  kind: ChatSessionKind;
  /** a manual rename: the automatic title stops changing */
  title_locked: boolean;
  /** UUID handed to the Claude CLI: --session-id on the first run, --resume afterwards */
  cli_session_id: string;
  cli_started: boolean;
  /** version (hash) of the pinned notes this chat last saw */
  notes_version: string;
  model: string;
  effort: string;
  context_tokens: number;
  input_tokens_total: number;
  output_tokens_total: number;
  cost_usd_micros_total: number;
  last_message_at: string | null;
}

export type ChatRole = "user" | "assistant";
export type ChatMessageState = "pending" | "streaming" | "done" | "error" | "stopped";

/** A chat message as stored; an assistant body grows while it streams */
export interface ChatMessage {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: Actor;
  session_id: number;
  role: ChatRole;
  body: string;
  state: ChatMessageState;
  /** browser UUID, user rows only: a retried send is idempotent on it */
  client_id: string | null;
  /** assistant rows only: the reply started with [[ack]] (an acknowledgement instead of an answer) */
  ack: boolean;
  input_mode: "text" | "voice";
  tools_json: string | null;
  error: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd_micros: number | null;
}

/** A file attached to a chat message; `message_id` stays null until the message is sent */
export interface ChatAttachment {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: Actor;
  session_id: number;
  message_id: number | null;
  name: string;
  mime: string;
  size: number;
  path: string;
}

/** The files of a message without their disk path */
export type ChatAttachmentInfo = Pick<ChatAttachment, "id" | "name" | "mime" | "size">;
export type ChatMessageWithFiles = ChatMessage & { attachments: ChatAttachmentInfo[] };

/** A background draft request as stored (table draft_runs) */
export interface DraftRun {
  id: number;
  created_at: string;
  updated_at: string;
  created_by: Actor;
  title: string;
  person_id: number | null;
  company_id: number | null;
  opportunity_id: number | null;
  project_id: number | null;
  idea_id: number | null;
  channel: Channel | null;
  state: DraftRunState;
  error: string | null;
  session_id: number | null;
  task_id: number | null;
  draft_id: number | null;
  drafts_before: number | null;
  started_at: string | null;
  finished_at: string | null;
}

/** The queue of background draft runs: the rows and their state changes; the server's queue starts the CLI and reports back through it */
export interface DraftRunsApi {
  /** a queued or running request with the same title and record, or null */
  activeTwin(input: unknown): DraftRun | null;
  /** stores a queued request (validated); the caller checks for a twin first */
  enqueue(input: unknown, taskId: number | null): DraftRun;
  get(id: number): DraftRun;
  /** queued and running requests, plus the finished ones whose draft still waits for Özgür (the buttons show "Taslak hazır"), newest first */
  live(): DraftRun[];
  queuedCount(): number;
  /** the oldest queued request, or null */
  next(): DraftRun | null;
  running(): DraftRun[];
  /** queued → running on its chat session; remembers the highest draft id so the draft it saves can be found */
  markRunning(id: number, sessionId: number): DraftRun;
  /** the draft a run saved: the first draft of Claude's after its start, preferring one on the request's record; null when it saved none */
  findDraft(id: number): number | null;
  markDone(id: number, draftId: number): DraftRun;
  /** a queued or running request fails with the reason shown to Özgür */
  markFailed(id: number, reason: string): DraftRun;
}

/**
 * Public API of the chat module (`ctx.mod("chat")`): sessions, messages and attachments of the panel chat. The inputs are the JSON the web sends;
 * they are validated inside. The Claude runner (server side) writes the assistant messages through it.
 */
export interface ChatApi {
  /** `run` makes the session of a background draft run (kind draft, a fixed title) */
  createSession(input?: unknown, run?: { title: string }): ChatSession;
  /** keyset on (last message time, id), newest first */
  listSessions(input?: unknown): { items: ChatSession[]; next_cursor: string | null };
  getSession(id: number): ChatSession;
  updateSession(id: number, input: unknown): ChatSession;
  /** soft delete: the session shows in the trash and can be restored */
  deleteSession(id: number): { effects: string[]; trash: { type: string; id: number } };
  restoreSession(id: number): { label: string; effects: string[] };
  /** `before` loads the page older than that message id; items come back oldest to newest */
  listMessages(sessionId: number, input?: unknown): { items: ChatMessageWithFiles[]; has_more: boolean };
  getMessage(id: number): ChatMessage;
  /** idempotent on (session, client_id) */
  addUserMessage(sessionId: number, input: unknown): ChatMessageWithFiles;
  /** a retried send: the user row for this client_id and the reply that followed it */
  findSend(sessionId: number, clientId: string): { user: ChatMessageWithFiles; reply: ChatMessage | null } | null;
  startAssistantMessage(sessionId: number): ChatMessage;
  appendAssistantText(messageId: number, text: string): void;
  setAssistantTools(messageId: number, tools: { name: string; summary: string; ok: boolean }[]): void;
  /** the message update and the session totals in one transaction; a finished row is never counted twice */
  finishAssistantMessage(messageId: number, input: unknown): ChatMessage;
  markCliStarted(sessionId: number): void;
  setNotesVersion(sessionId: number, version: string): void;
  createAttachment(sessionId: number, input: unknown): ChatAttachment;
  getAttachment(id: number): ChatAttachment;
  attachmentsOfMessage(messageId: number): ChatAttachment[];
  /** boot cleanup: a run owned by a dead server can never finish; returns how many rows were closed */
  failDanglingRuns(reason: string): number;
  draftRuns: DraftRunsApi;
}
