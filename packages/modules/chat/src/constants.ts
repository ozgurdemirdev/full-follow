// ---- Panel chat ----
/** Models the panel chat may use; context is the window the CLI assumes (it warns "not in catalog" for Haiku 5.5 and auto compacts at 200K); ids are passed to the Claude CLI, so they come only from this list */
export const CHAT_MODELS = [
  { id: "claude-opus-5-5", label: "Opus 5.5", context: 1_000_000 },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", context: 1_000_000 },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", context: 200_000 },
] as const;
export const CHAT_MODEL_IDS = CHAT_MODELS.map((m) => m.id) as unknown as readonly [string, ...string[]];
export const CHAT_EFFORTS = [
  { id: "low", label: "Düşük" },
  { id: "medium", label: "Orta" },
  { id: "high", label: "Yüksek" },
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
  maxImageBytes: 5 * 1024 * 1024,
  maxFileBytes: 10 * 1024 * 1024,
  /** text attachments longer than this are cut before they reach the CLI (a 10 MB file would fill the context) */
  maxTextAttachmentChars: 100_000,
} as const;
/** The first message becomes the title of a chat: this many characters, cut at a word boundary */
export const CHAT_TITLE_CHARS = 60;
/** Turkish text stored in chat_messages.error and shown by the web; the server picks one by error code */
export const CHAT_ERROR_TEXT = {
  cli_missing: "Claude Code bulunamadı. Terminalde `npm i -g @anthropic-ai/claude-code` çalıştır.",
  cli_auth: "Claude oturumu kapanmış. Terminalde `claude auth login` çalıştır, sonra tekrar dene.",
  cli_limit: "Claude kullanım sınırına takıldın. Sınır yenilenince tekrar dene.",
  cli_crash: "Claude beklenmedik şekilde kapandı. Tekrar dene.",
  timeout: "Cevap çok uzun sürdü ve durduruldu.",
  busy: "Önceki cevap bitmeden yeni mesaj gönderilemez.",
  too_many_runs: "Aynı anda çok fazla sohbet çalışıyor, birinin bitmesini bekle.",
  restart: "Sunucu yeniden başladı, bu cevap yarım kaldı.",
  unknown: "Bir hata oldu. Tekrar dene.",
} as const;
export type ChatErrorCode = keyof typeof CHAT_ERROR_TEXT;
