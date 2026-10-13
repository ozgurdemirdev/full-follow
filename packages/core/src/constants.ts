export const ACTORS = ["ozgur", "claude"] as const;
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
/** Silinen kayıt çöp kutusuna gider (geri yüklenir); kategoriler (etiket, sektör, kaynak) yerinde gizlenir */
export const TRASH_TYPES = ["person", "company", "opportunity", "project", "task", "touch", "note", "post", "template", "idea", "draft", "payment", "comment", "interest", "link", "goal", "own_project", "opportunity_person", "offer", "file"] as const;
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

export const PROJECT_STAGES = ["pesinat", "tasarim_onayi", "test_surumu", "yayin", "teslim", "bakim", "iptal"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];
export const MILESTONES = ["pesinat", "tasarim_onayi", "test_surumu", "yayin", "teslim", "bakim"] as const;

export const ASSIGNEES = ACTORS;
export const COMMENT_TARGETS = ["person", "company", "opportunity", "project", "task", "draft", "payment", "post", "idea", "own_project"] as const;
export type CommentTarget = (typeof COMMENT_TARGETS)[number];
/** Role of an extra person on an opportunity (the main contact is opportunities.person_id and has no role) */
export const OPP_ROLES = ["karar_verici", "teknik", "ortak", "diger"] as const;
export type OppRole = (typeof OPP_ROLES)[number];
/** Records that can hold uploaded files */
export const FILE_TARGETS = ["opportunity", "project"] as const;
/** Records that carry labelled links (roadmap, proposal deck, Figma, repo) */
export const LINK_TARGETS = ["opportunity", "project", "own_project"] as const;

/** find/get/save/delete için kayıt türleri */
export const RECORD_TYPES = [
  "person", "company", "opportunity", "project", "task", "draft", "payment", "source", "comment", "touch", "setting",
  "sector", "note", "tag", "trash", "link", "offer",
  // günlük iş planı
  "goal", "goal_log",
  // Paket 2: pazarlama
  "post", "template", "idea", "interest",
  // kendi projelerim
  "own_project",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const TYPE_ALIASES: Record<string, RecordType> = {
  opp: "opportunity", fırsat: "opportunity", firsat: "opportunity",
  kisi: "person", kişi: "person", people: "person",
  firma: "company", proje: "project", gorev: "task", görev: "task",
  taslak: "draft", odeme: "payment", ödeme: "payment", kaynak: "source",
  yorum: "comment", temas: "touch", ayar: "setting", settings: "setting",
  sektor: "sector", sektör: "sector", not: "note", notes: "note", links: "link", linkler: "link", baglanti: "link", bağlantı: "link", teklif: "offer", teklifler: "offer", offers: "offer",
  paylasim: "post", paylaşım: "post", posts: "post", sablon: "template", şablon: "template", templates: "template",
  fikir: "idea", ideas: "idea", ilgi: "interest",
  hedef: "goal", hedefler: "goal", goals: "goal", ilerleme: "goal_log", progress: "goal_log",
  own: "own_project", own_projects: "own_project", kendi_proje: "own_project", "kendi projem": "own_project", projelerim: "own_project", urunum: "own_project",
  etiket: "tag", tags: "tag", companies: "company", firmalar: "company", cop: "trash", "çöp": "trash", "çöp kutusu": "trash",
};

// ---- Paket 2: pazarlama ----
/** Paylaşım platformları (forum konusu, gönderi) */
export const POST_PLATFORMS = ["r10", "linkedin", "instagram", "diger"] as const;
export const PLATFORM_LABEL: Record<string, string> = { r10: "R10", linkedin: "LinkedIn", instagram: "Instagram", diger: "Diğer" };
/** Mesaj şablonu türü: ilk mesaj, takip, teklif sonrası, diğer */
export const TEMPLATE_KINDS = ["ilk", "takip", "teklif", "diger"] as const;
/** Own product lifecycle */
export const OWN_PROJECT_STATUSES = ["aktif", "beklemede", "tamamlandi", "birakildi"] as const;
/** Could this own product be sold later */
export const SELLABLE = ["evet", "belki", "hayir"] as const;
/** Project idea priority, in display order */
export const IDEA_PRIORITIES = ["yuksek", "orta", "dusuk"] as const;
export const IDEA_STAGES = ["fikir", "dogrulaniyor", "demo", "urun"] as const;
/** Fikir anlatılan kişinin ilgisi */
export const INTEREST_LEVELS = ["anlatildi", "ilgilendi", "ilgilenmedi"] as const;
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
  "followup_days", "weekly_target", "channel_limits", "email_warmup_until", "chat_pinned_notes",
] as const;

/** Network ayarlarının varsayılanları (gün) */
export const NETWORK_DEFAULTS = { reply_wait_days: 3, cooling_days: 30 } as const;

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
  aktif: "aktif", beklemede: "beklemede", tamamlandi: "tamamlandı", birakildi: "bırakıldı",
  yuksek: "yüksek", orta: "orta", dusuk: "düşük", evet: "evet", belki: "belki", hayir: "hayır",
  karar_verici: "karar verici", teknik: "teknik", ortak: "ortak",
};
export const label = (k: string) => LABELS[k] ?? k;

// ---- Günlük iş planı ----
/** Hafta günleri ISO numarasıyla (1 = pazartesi); hedef tekrarı bu numaraların virgüllü listesidir */
export const GOAL_DAY_PRESETS = { her_gun: [1, 2, 3, 4, 5, 6, 7], hafta_ici: [1, 2, 3, 4, 5], hafta_sonu: [6, 7] } as const;
export const WEEKDAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;

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
/** Max name length kept for an uploaded file */
export const FILE_NAME_MAX = 120;
/** Max items in one offer price breakdown */
export const OFFER_ITEMS_MAX = 30;
/** Max length of the pinned notes text that goes into every panel chat */
export const CHAT_PINNED_MAX = 4_000;
export const CHAT_NEW_TITLE = "Yeni sohbet";
export const CHAT_TITLE_CHARS = 60;
export const CHAT_ROLES = ["user", "assistant"] as const;
export const CHAT_INPUT_MODES = ["text", "voice"] as const;
export const CHAT_STATES = ["pending", "streaming", "done", "error", "stopped"] as const;
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
