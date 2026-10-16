import { CLAUDE_EFFORT_IDS, CLAUDE_MODEL_IDS, type ClaudeEffortId, type ClaudeModelId } from "@fullfollow/core";
import { m } from "./messages";

/** Bytes in a megabyte, the unit of the upload limits */
export const BYTES_PER_MB = 1024 * 1024;

// ---- Panel chat ----
/** Label and context window of each model core allows; context is the window the CLI assumes (it warns "not in catalog" for Haiku 5.5 and auto compacts at 200K) */
const MODEL_INFO: Record<ClaudeModelId, { label: string; context: number }> = {
  "claude-opus-5-5": { label: "Opus 5.5", context: 1_000_000 },
  "claude-sonnet-5-5": { label: "Sonnet 5.5", context: 1_000_000 },
  "claude-haiku-5-5": { label: "Haiku 5.5", context: 200_000 },
};
/** Models the panel chat and the draft runs may use; ids are passed to the Claude CLI, so they come only from core's list */
export const CHAT_MODELS = CLAUDE_MODEL_IDS.map((id) => ({ id, ...MODEL_INFO[id] }));
export const CHAT_MODEL_IDS = CLAUDE_MODEL_IDS;
const EFFORT_LABEL = m.efforts as Record<ClaudeEffortId, string>;
export const CHAT_EFFORTS = CLAUDE_EFFORT_IDS.map((id) => ({ id, label: EFFORT_LABEL[id] }));
export const CHAT_EFFORT_IDS = CLAUDE_EFFORT_IDS;
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

// ---- Background draft runs ----
export const DRAFT_RUN_LIMITS = {
  /** runs that write at the same time; the rest wait their turn in the queue */
  concurrency: 1,
  /** requests that may wait at once; one more is refused until the queue moves */
  maxQueued: 10,
  /** a finished run whose draft still waits keeps its "Taslak hazır" button this long */
  readyKeepMs: 24 * 60 * 60_000,
  /** most rows GET /api/draft-runs returns */
  listMax: 50,
  /** characters of the record name in the run's session title */
  titleNameChars: 40,
} as const;
/** The SSE channel of the draft queue in the event hub (session ids start at 1, so it never meets a session) */
export const DRAFT_RUNS_CHANNEL = 0;
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

/**
 * Environment variables the Claude CLI process receives (nothing else: no FF_PASSWORD, no cookie secret, no other tool's tokens).
 * Names are matched case-insensitively (Windows spells Path, ProgramFiles and so on in mixed case).
 */
export const CLI_ENV_NAMES = [
  // finding programs and the user's folders
  "PATH", "PATHEXT", "HOME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "TMPDIR",
  "USER", "USERNAME", "LOGNAME", "SHELL", "COMSPEC", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432",
  "COMMONPROGRAMFILES", "COMMONPROGRAMFILES(X86)", "COMMONPROGRAMW6432", "OS", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE",
  "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME", "XDG_RUNTIME_DIR",
  // language and terminal
  "LANG", "LANGUAGE", "LC_ALL", "LC_CTYPE", "TERM", "COLORTERM", "NO_COLOR", "FORCE_COLOR", "TZ",
  // network: proxies and certificate files
  "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "ALL_PROXY", "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS",
] as const;
/** Variable name prefixes passed on as well: the CLI's own settings and sign-in (API key, OAuth token, Bedrock or Vertex credentials) */
export const CLI_ENV_PREFIXES = ["ANTHROPIC_", "CLAUDE_", "AWS_", "GOOGLE_", "CLOUD_ML_", "VERTEX_"] as const;
