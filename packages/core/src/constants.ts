export const ACTORS = ["owner", "claude"] as const;
export type Actor = (typeof ACTORS)[number];

/** Paket 3: etiketler veritabanında (tags). Bunlar ilk kurulumda açılan varsayılanların kısa adları (slug). */
export const TAGS = ["aday", "musteri", "ajans", "is_ortagi", "network", "r10", "sicak", "fuar"] as const;
/** Bu slug'lı etiketlerden biri varsa kişi "bağlantı" sayılır (soğuma takibi) */
export const CONNECTION_TAGS = ["musteri", "ajans", "is_ortagi", "network"] as const;
/** Etiket renkleri: web bunları tasarım token'larına eşler */
export const TAG_COLORS = ["aday", "musteri", "ajans", "is_ortagi", "network", "opportunity", "source", "payment", "warning", "success"] as const;
/** Firma ve kişinin temas durumu: temaslarla ileri gider, geri gitmez; "olumsuz", "tanidik" ve "arkadas" sadece elle */
export const CONTACT_STATUSES = ["yazilmadi", "yazildi", "cevap_geldi", "gorusuldu", "olumsuz", "es_gecildi", "tanidik", "arkadas"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
/** Role of a person in a buying decision (decision maker, influencer, user) */
export const INFLUENCE = ["karar_verici", "etkileyici", "kullanici"] as const;
export type Influence = (typeof INFLUENCE)[number];
/** Set by hand; touches never move these */
export const STICKY_CONTACT_STATUSES: readonly ContactStatus[] = ["olumsuz", "tanidik", "arkadas"];
/** How far a status has come: a touch only moves a status forward (a negative rank is a hand set one) */
export const CONTACT_STATUS_RANK: Record<ContactStatus, number> = { yazilmadi: 0, yazildi: 1, cevap_geldi: 2, gorusuldu: 3, olumsuz: -1, es_gecildi: -1, tanidik: -1, arkadas: -1 };
/** Silinen kayıt çöp kutusuna gider (geri yüklenir); kategoriler (etiket, sektör, kaynak) yerinde gizlenir. Modüllerin türleri kayıt defterinden gelir (trash.type sütunu düz metindir). */
/** Quick answers Claude can attach to a question: how many, and how long each may be */
export const COMMENT_OPTIONS_MAX = 4;
export const COMMENT_OPTION_CHARS = 40;
export const CORE_TRASH_TYPES = ["note", "comment", "link", "file"] as const;
export const SOURCE_KINDS = ["forum", "liste", "referans", "sosyal", "diger"] as const;

export const OPP_STAGES = ["bulundu", "temas", "cevap", "gorusme", "teklif", "kazanildi", "kaybedildi"] as const;
export type OppStage = (typeof OPP_STAGES)[number];
export const OPEN_OPP_STAGES = ["bulundu", "temas", "cevap", "gorusme", "teklif"] as const;

/** Network kanalları önde: soğuk e-posta, Instagram DM, LinkedIn, telefon, yüz yüze */
export const CHANNELS = ["email", "instagram", "linkedin", "telefon", "yuz_yuze", "whatsapp", "r10", "diger"] as const;
export type Channel = (typeof CHANNELS)[number];
export const DIRECTIONS = ["giden", "gelen"] as const;
export const TOUCH_KINDS = ["mesaj", "arama", "gorusme"] as const;
export const DRAFT_STATUSES = ["bekliyor", "onaylandi", "gonderildi", "reddedildi"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const PROJECT_STAGES = ["pesinat", "tasarim_onayi", "test_surumu", "yayin", "teslim", "bakim", "iptal"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];
/** The milestone every payment plan holds exactly once: a project starts there and cannot move past it until it is paid */
export const DEPOSIT_MILESTONE = "pesinat";
export const MILESTONES = ["pesinat", "tasarim_onayi", "test_surumu", "yayin", "teslim", "bakim"] as const;

/** A comment target type: a record type core owns (`TARGET_TABLE` in services/shared.ts) or one a module adds (`commentTargets` contribution) */
export type CommentTarget = string;
/** Role of an extra person on an opportunity (the main contact is opportunities.person_id and has no role) */
export const OPP_ROLES = ["karar_verici", "teknik", "ortak", "diger"] as const;
export type OppRole = (typeof OPP_ROLES)[number];

/** find/get/save/delete için kayıt türleri */
/** Record types that belong to a feature module, and the module key that owns each: names the missing module in the error when it is not installed */
export const MODULE_TYPE_OWNER = {
  task: "calendar", goal: "calendar", goal_log: "calendar", post: "posts", person: "people", company: "companies", touch: "network",
  opportunity: "pipeline", offer: "pipeline", opportunity_person: "pipeline", project: "projects", payment: "projects",
  draft: "drafts", template: "templates", idea: "ideas", interest: "ideas", own_project: "own-projects",
} as const;

export const RECORD_TYPES = [
  "source", "comment", "setting",
  "sector", "note", "tag", "trash", "link",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const TYPE_ALIASES: Record<string, RecordType> = {
  kaynak: "source",
  yorum: "comment", ayar: "setting", settings: "setting",
  sektor: "sector", sektör: "sector", not: "note", notes: "note", links: "link", linkler: "link", baglanti: "link", bağlantı: "link",
  etiket: "tag", tags: "tag", cop: "trash", "çöp": "trash", "çöp kutusu": "trash",
};

// ---- Paket 2: pazarlama ----
/** Mesaj şablonu türü: ilk mesaj, takip, teklif sonrası, diğer */
export const TEMPLATE_KINDS = ["ilk", "takip", "teklif", "diger"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
/** A reply rate over fewer messages than this is "early": too noisy to rank on (templates, lead sources) */
export const RATE_MIN_SAMPLE = 20;
export const TEMPLATE_MIN_SAMPLE = RATE_MIN_SAMPLE;
/** Lead source funnel steps, in order; each step counts the records that reached it (a later step implies the earlier ones) */
export const SOURCE_FUNNEL_STEPS = ["found", "written", "replied", "meeting", "offer", "won"] as const;
/** Funnel period in days by record creation date ("all" = no filter) and the one used when none is given */
export const SOURCE_FUNNEL_PERIODS = [30, 90, "all"] as const;
export const SOURCE_FUNNEL_DEFAULT_PERIOD = 90;
/** Opportunity stages that mean an offer was made; a lost one is recognised from its stage events */
export const OFFER_STAGES = ["teklif", "kazanildi"] as const;
/** The lowest reply rate third of the sources with enough sample is flagged weak */
export const SOURCE_WEAK_SHARE = 1 / 3;
/** Sector label of recipients that have no sector, in the template breakdown */
export const NO_SECTOR_LABEL = "Sektörsüz";
/** Own product lifecycle */
export const OWN_PROJECT_STATUSES = ["aktif", "beklemede", "tamamlandi", "birakildi"] as const;
export type OwnProjectStatus = (typeof OWN_PROJECT_STATUSES)[number];
/** Could this own product be sold later */
export const SELLABLE = ["evet", "belki", "hayir"] as const;
export type Sellable = (typeof SELLABLE)[number];
/** Project idea priority, in display order */
export const IDEA_PRIORITIES = ["yuksek", "orta", "dusuk"] as const;
export type IdeaPriority = (typeof IDEA_PRIORITIES)[number];
export const IDEA_STAGES = ["fikir", "dogrulaniyor", "demo", "urun"] as const;
export type IdeaStage = (typeof IDEA_STAGES)[number];
/** Fikir anlatılan kişinin ilgisi */
export const INTEREST_LEVELS = ["anlatildi", "ilgilendi", "ilgilenmedi"] as const;
export type InterestLevel = (typeof INTEREST_LEVELS)[number];
/** Pazarlama ayarlarının varsayılanları: takip dizisi günleri (ilk cevapsız mesajdan sonra), haftalık giden mesaj hedefi (0 = kapalı) */
export const MARKETING_DEFAULTS = { followup_days: [3, 7], weekly_target: 0 } as const;
/** Daily outgoing message limit per channel (a channel without a limit has no counter) */
export const CHANNEL_LIMIT_DEFAULTS: Readonly<Partial<Record<Channel, number>>> = { email: 20, instagram: 15, whatsapp: 15 };
/** Highest daily limit a channel can be given */
export const CHANNEL_LIMIT_MAX = 500;
/** A channel counts as "near" its limit from this share of it */
export const QUOTA_NEAR_RATIO = 0.8;

export const SETTING_KEYS = [
  "bagkur_monthly", "accounting_monthly", "other_fixed_monthly", "target_net_monthly",
  "tax_rate_percent", "payment_template", "reply_wait_days", "cooling_days",
  "followup_days", "weekly_target", "channel_limits", "email_warmup_until", "chat_pinned_notes", "focus_own_project_id", "post_refresh_days", "draft_rules", "modules_hidden", "owner_name",
  "draft_auto", "draft_model", "draft_effort",
  "chat_full_access", "chat_web_fetch", "chat_local_files", "chat_local_folders",
  "phone_access",
] as const;

/**
 * Settings only the owner may write; Claude (MCP, the panel chat) is refused. Each one feeds Claude's prompts or turns features on
 * and off, so text a page or a record planted in Claude would otherwise persist and steer later chats: the pinned notes and the
 * draft rules are read into the system prompt, the hidden modules take screens away, and the auto draft switch, model and effort
 * decide how much of the owner's Claude usage background draft runs spend. The panel chat's access settings (full authority, page
 * reading, local files and their folders) decide what Claude may do without asking, so Claude must never widen them itself. Phone
 * access opens the server to the local network at the next start.
 */
export const OWNER_ONLY_SETTINGS: readonly (typeof SETTING_KEYS)[number][] = [
  "chat_pinned_notes", "draft_rules", "modules_hidden", "owner_name", "draft_auto", "draft_model", "draft_effort",
  "chat_full_access", "chat_web_fetch", "chat_local_files", "chat_local_folders", "phone_access",
];

/** Days after which a post is due for a refresh when it has no interval of its own (setting `post_refresh_days`), and the longest interval allowed */
export const POST_REFRESH_DEFAULT_DAYS = 30;
export const POST_REFRESH_MAX_DAYS = 365;

/** The rules Claude learns from reject notes (setting `draft_rules`): how many are kept (the oldest drop first) and how long one may be */
export const DRAFT_RULES_MAX = 30;
export const DRAFT_RULE_CHARS = 200;

/** Network ayarlarının varsayılanları (gün) */
export const NETWORK_DEFAULTS = { reply_wait_days: 3, cooling_days: 30 } as const;

/** Number of ISO weeks in the per person contact rhythm (the current week is the last one) */
export const RHYTHM_WEEKS = 12;

/** Kazanınca üretilen ödeme planı şablonu (settings.payment_template ile değiştirilebilir) */
export const DEFAULT_PAYMENT_TEMPLATE = [
  { milestone: "pesinat", percent: 40, days: 0 },
  { milestone: "tasarim_onayi", percent: 30, days: 14 },
  { milestone: "yayin", percent: 30, days: 30 },
] as const;

/** Ekranda ve olay özetlerinde görünen adlar */
export const LABELS: Record<string, string> = {
  gorusme: "görüşme", kazanildi: "kazanıldı", pesinat: "peşinat", tasarim_onayi: "tasarım onayı",
  test_surumu: "test sürümü", yayin: "yayın", bakim: "bakım", musteri: "müşteri", is_ortagi: "iş ortağı",
  bekliyor: "bekliyor", onaylandi: "onaylandı", gonderildi: "gönderildi", reddedildi: "reddedildi",
  yuz_yuze: "yüz yüze", instagram: "Instagram DM", email: "e-posta",
  linkedin: "LinkedIn", whatsapp: "WhatsApp", r10: "R10",
  dogrulaniyor: "doğrulanıyor", urun: "ürün", anlatildi: "anlatıldı", ilk: "ilk mesaj", diger: "diğer",
  yazilmadi: "yazılmadı", yazildi: "yazıldı", cevap_geldi: "cevap geldi", gorusuldu: "görüşüldü", es_gecildi: "es geçildi", tanidik: "tanıdık", arkadas: "arkadaş",
  new_records: "yeni kayıt", aktif: "aktif", beklemede: "beklemede", tamamlandi: "tamamlandı", birakildi: "bırakıldı",
  yuksek: "yüksek", orta: "orta", dusuk: "düşük", evet: "evet", belki: "belki", hayir: "hayır",
  karar_verici: "karar verici", teknik: "teknik", ortak: "ortak",
};
export const label = (k: string) => LABELS[k] ?? k;

// ---- Weekly review (Friday summary, services/review.ts) ----

// ---- Bulk saves ----
/** Event written once per bulk save that skipped duplicates; data: { record_type, count, keys } */
export const BULK_SKIPPED_EVENT = "bulk.skipped";

/** What a chat message may carry. kind decides how the file reaches the CLI: image and PDF as base64 blocks, text inlined. */
export const CHAT_ATTACHMENT_TYPES = [
  { ext: "png", mime: "image/png", kind: "image" },
  { ext: "jpg", mime: "image/jpeg", kind: "image" },
  { ext: "jpeg", mime: "image/jpeg", kind: "image" },
  { ext: "gif", mime: "image/gif", kind: "image" },
  { ext: "webp", mime: "image/webp", kind: "image" },
  { ext: "pdf", mime: "application/pdf", kind: "pdf" },
  { ext: "txt", mime: "text/plain", kind: "text" },
  { ext: "md", mime: "text/markdown", kind: "text" },
  { ext: "csv", mime: "text/csv", kind: "text" },
] as const;
/** What an opportunity or project file may be: the chat types plus Office files (a zip container, told apart by extension) */
export const FILE_TYPES = [
  ...CHAT_ATTACHMENT_TYPES,
  { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "office" },
  { ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "office" },
  { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "office" },
] as const;
/** Upload limits of record files (offer decks and scans are bigger than chat attachments) */
export const FILE_LIMITS = { maxImageBytes: 10 * 1024 * 1024, maxFileBytes: 25 * 1024 * 1024 } as const;
/** Folders of uploaded bytes, beside the database: record files and the chat's attachments */
export const UPLOAD_DIRS = { files: "files", chat: "chat/uploads" } as const;
/** All uploaded bytes together may take this much; an upload past it is refused (413) */
export const UPLOAD_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;
/** Max name length kept for an uploaded file */
export const FILE_NAME_MAX = 120;
/** Max items in one offer price breakdown */
export const OFFER_ITEMS_MAX = 30;
/** Max parts of an offer's payment plan (one per project milestone) */
export const OFFER_PLAN_PARTS_MAX = MILESTONES.length;
/** The percentages of an offer's payment plan add up to this */
export const OFFER_PLAN_TOTAL_PCT = 100;
/** Max length of the pinned notes text that goes into every panel chat */
export const CHAT_PINNED_MAX = 4_000;
/** Folders the panel chat may read and write while local files are on (setting `chat_local_folders`): how many, and the longest path */
export const CHAT_LOCAL_FOLDERS_MAX = 20;
export const CHAT_FOLDER_PATH_MAX = 500;
/** Where a confirmation the panel chat asked for is: waiting, answered yes or no, no answer in time, or the run ended before an answer */
export const CHAT_PERMISSION_STATES = ["pending", "allowed", "denied", "expired", "cancelled"] as const;
export type ChatPermissionState = (typeof CHAT_PERMISSION_STATES)[number];
/** The MCP host of a panel chat reads its chat session id from this variable; only then does it serve the confirmation tool */
export const MCP_CHAT_SESSION_ENV = "FF_CHAT_SESSION";
/** Max length of the owner's name (setting `owner_name`): the UI labels and the panel Claude's system prompt carry it */
export const OWNER_NAME_MAX = 40;
/** The app password the owner sets in the first run setup or in Settings: at least this many characters, at most the max (a bound on the hashing work) */
export const OWNER_PASSWORD_MIN = 10;
export const OWNER_PASSWORD_MAX = 256;
/** The `code` of the 401 every API route answers while the install has no password yet (first run): the web shows the setup screen */
export const SETUP_REQUIRED_CODE = "setup_required";
export const CHAT_NEW_TITLE = "Yeni sohbet";
export const CHAT_ROLES = ["user", "assistant"] as const;
export const CHAT_INPUT_MODES = ["text", "voice"] as const;
export const CHAT_STATES = ["pending", "streaming", "done", "error", "stopped"] as const;
/** A chat session is a conversation in the panel, or a background run that writes one draft (restricted tools) */
export const CHAT_SESSION_KINDS = ["chat", "draft"] as const;
export type ChatSessionKind = (typeof CHAT_SESSION_KINDS)[number];
/** Model ids the Claude CLI may be started with (the chat module adds labels and context sizes); settings and requests are checked against them */
export const CLAUDE_MODEL_IDS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"] as const;
export type ClaudeModelId = (typeof CLAUDE_MODEL_IDS)[number];
export const CLAUDE_EFFORT_IDS = ["low", "medium", "high"] as const;
export type ClaudeEffortId = (typeof CLAUDE_EFFORT_IDS)[number];
/** Background draft runs (settings `draft_auto`, `draft_model`, `draft_effort`): on, and the model and effort they start with */
export const DRAFT_AUTO_DEFAULTS = { on: true, model: "claude-sonnet-5-5", effort: "medium" } as const satisfies { on: boolean; model: ClaudeModelId; effort: ClaudeEffortId };
/** The MCP host reads its mode from this variable; a mode limits the tools it registers (an unknown mode refuses to start) */
export const MCP_MODE_ENV = "FF_MCP_MODE";
/** The only tools of the MCP host in mode "draft" (a background draft run): reading records and saving a draft. The Claude CLI's allowlist of that run names the same ones. */
export const MCP_MODE_TOOLS = { draft: ["get", "find", "timeline", "draft"] } as const satisfies Record<string, readonly string[]>;
export type McpMode = keyof typeof MCP_MODE_TOOLS;
/** The generic tools the MCP host itself registers (the installed modules add their own: plan, pay, ...) */
export const MCP_CORE_TOOLS = ["today", "open", "find", "get", "save", "move", "delete"] as const;
/** Where a background draft run is: waiting its turn, running, finished with a draft, or failed */
export const DRAFT_RUN_STATES = ["queued", "running", "done", "failed"] as const;
export type DraftRunState = (typeof DRAFT_RUN_STATES)[number];

// ---- List sizes and text lengths
/** A `limit` that means every row: lists the app builds in memory and filters itself */
export const ALL_ROWS = 100_000;
/** A list read that wants one record: a record by its id is a list narrowed by `ids` and cut to one row */
export const ONE_ROW = 1;
/** Rows of a list when the caller gives no limit */
export const LIST_PAGE_SIZE = 20;
/** Most rows one list request can ask for over HTTP (a bigger `limit` is cut to it) */
export const LIST_LIMIT_MAX = 1000;
/** Related rows per relation in `get` (default and ceiling) */
export const RELATED_ROWS_DEFAULT = 10;
export const RELATED_ROWS_MAX = 200;
/** Candidates an "ambiguous" error and a bulk label list name */
export const AMBIGUOUS_SHOWN = 8;
/** Characters of a record's text kept in an event summary, a trash label and a bulk label */
export const SUMMARY_PREVIEW_CHARS = 60;

// ---- Database
/** How long a locked database is waited for before a write fails */
export const DB_BUSY_TIMEOUT_MS = 5000;
/** Daily backups kept (the newest ones) */
export const BACKUPS_KEPT = 14;
/** Broken foreign keys quoted in the error a migration raises */
export const BROKEN_KEYS_SHOWN = 3;
