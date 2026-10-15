import { m } from "./messages";

/** Bytes in a megabyte, the unit of the upload limits */
export const BYTES_PER_MB = 1024 * 1024;

// ---- Panel chat ----
/** Models the panel chat may use; context is the window the CLI assumes (it warns "not in catalog" for Haiku 5.5 and auto compacts at 200K); ids are passed to the Claude CLI, so they come only from this list */
export const CHAT_MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5", context: 1_000_000 },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", context: 1_000_000 },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", context: 200_000 },
] as const;
export const CHAT_MODEL_IDS = CHAT_MODELS.map((model) => model.id) as unknown as readonly [string, ...string[]];
export const CHAT_EFFORTS = [
  { id: "low", label: m.efforts.low },
  { id: "medium", label: m.efforts.medium },
  { id: "high", label: m.efforts.high },
] as const;
export const CHAT_EFFORT_IDS = CHAT_EFFORTS.map((e) => e.id) as unknown as readonly [string, ...string[]];
export const CHAT_DEFAULTS = { model: "claude-haiku-5-5", effort: "low" } as const;
export const CHAT_LIMITS = {
  maxBodyChars: 8_000,
  sessionsPageSize: 30,
  messagesPageSize: 30,
  maxActiveProcesses: 2,
  idleKillMs: 10 * 60_000,
  runTimeoutMs: 10 * 60_000,
  textFlushMs: 400,
  ringBufferEvents: 2_000,
  sseHeartbeatMs: 15_000,
  sseRetryMs: 3_000,
  haikuPriceStepTokens: 100_000,
  maxAttachments: 5,
  maxImageBytes: 5 * BYTES_PER_MB,
  maxFileBytes: 10 * BYTES_PER_MB,
  /** text attachments longer than this are cut before they reach the CLI (a 10 MB file would fill the context) */
  maxTextAttachmentChars: 100_000,
} as const;
/** The first message becomes the title of a chat: this many characters, cut at a word boundary */
export const CHAT_TITLE_CHARS = 60;
/** Longest values the API accepts: a title typed by hand, the client's message id, the name of an uploaded file */
export const CHAT_FIELD_MAX = { title: 120, clientId: 64, attachmentName: 200 } as const;
/** Characters of a CLI error and of a stray stdout line kept in the developer log */
export const LOG_RAW_CHARS = 200;
export const LOG_LINE_CHARS = 120;
/** Characters of the sha1 kept as the pinned notes version */
export const NOTES_VERSION_CHARS = 12;
/** Turkish text stored in chat_messages.error and shown by the web; the server picks one by error code */
export const CHAT_ERROR_TEXT = m.errorTexts;
export type ChatErrorCode = keyof typeof CHAT_ERROR_TEXT;
