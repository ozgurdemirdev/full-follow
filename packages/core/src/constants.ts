export const ACTORS = ["ozgur", "claude"] as const;
export type Actor = (typeof ACTORS)[number];

export const TAGS = ["aday", "musteri", "ajans", "is_ortagi", "network"] as const;
export const SOURCE_KINDS = ["forum", "liste", "referans", "sosyal", "diger"] as const;

export const OPP_STAGES = ["bulundu", "temas", "cevap", "gorusme", "teklif", "kazanildi", "kaybedildi"] as const;
export type OppStage = (typeof OPP_STAGES)[number];
export const OPEN_OPP_STAGES = ["bulundu", "temas", "cevap", "gorusme", "teklif"] as const;

export const CHANNELS = ["whatsapp", "email", "telefon", "yuz_yuze", "r10", "instagram", "linkedin", "diger"] as const;
export const DIRECTIONS = ["giden", "gelen"] as const;
export const TOUCH_KINDS = ["mesaj", "arama", "gorusme"] as const;
export const DRAFT_STATUSES = ["bekliyor", "onaylandi", "gonderildi", "reddedildi"] as const;

export const PROJECT_STAGES = ["pesinat", "tasarim_onayi", "test_surumu", "yayin", "teslim", "bakim", "iptal"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];
export const MILESTONES = ["pesinat", "tasarim_onayi", "test_surumu", "yayin", "teslim", "bakim"] as const;

export const ASSIGNEES = ACTORS;
export const COMMENT_TARGETS = ["person", "company", "opportunity", "project", "task", "draft", "payment"] as const;
export type CommentTarget = (typeof COMMENT_TARGETS)[number];

/** find/get/save/delete için kayıt türleri */
export const RECORD_TYPES = [
  "person", "company", "opportunity", "project", "task", "draft", "payment", "source", "comment", "touch", "setting",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const TYPE_ALIASES: Record<string, RecordType> = {
  opp: "opportunity", fırsat: "opportunity", firsat: "opportunity",
  kisi: "person", kişi: "person", people: "person",
  firma: "company", proje: "project", gorev: "task", görev: "task",
  taslak: "draft", odeme: "payment", ödeme: "payment", kaynak: "source",
  yorum: "comment", temas: "touch", ayar: "setting", settings: "setting",
};

export const SETTING_KEYS = [
  "bagkur_monthly", "accounting_monthly", "other_fixed_monthly", "target_net_monthly",
  "tax_rate_percent", "payment_template",
] as const;

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
  yuz_yuze: "yüz yüze",
};
export const label = (k: string) => LABELS[k] ?? k;
