// Ekranda görünen adlar ve token sınıf eşlemeleri.
// Tailwind sınıfları derleme anında tarandığı için tam sınıf adları burada açıkça yazılır.

export type Actor = "ozgur" | "claude";
export type OppStage = "bulundu" | "temas" | "cevap" | "gorusme" | "teklif" | "kazanildi" | "kaybedildi";
export type ProjectStage = "pesinat" | "tasarim_onayi" | "test_surumu" | "yayin" | "teslim" | "bakim" | "iptal";
export type Tone = "opportunity" | "source" | "payment" | "warning" | "neutral" | "success" | "claude";

export const OPEN_STAGES: OppStage[] = ["bulundu", "temas", "cevap", "gorusme", "teklif"];
export const BOARD_STAGES: OppStage[] = [...OPEN_STAGES, "kazanildi"];
export const PROJECT_STEPS: ProjectStage[] = ["pesinat", "tasarim_onayi", "test_surumu", "yayin", "teslim", "bakim"];

export const STAGE: Record<OppStage, string> = {
  bulundu: "Bulundu", temas: "Temas", cevap: "Cevap", gorusme: "Görüşme", teklif: "Teklif", kazanildi: "Kazanıldı", kaybedildi: "Kaybedildi",
};
export const PROJECT_STAGE: Record<ProjectStage, string> = {
  pesinat: "Peşinat", tasarim_onayi: "Tasarım onayı", test_surumu: "Test sürümü", yayin: "Yayın", teslim: "Teslim", bakim: "Bakım", iptal: "İptal",
};
export const MILESTONE: Record<string, string> = { ...PROJECT_STAGE };

/** Role of an extra person on an opportunity, in display order */
export const OPP_ROLE: Record<string, string> = { karar_verici: "Karar verici", teknik: "Teknik", ortak: "Ortak", diger: "Diğer" };
export const OPP_ROLES = Object.keys(OPP_ROLE);

/** Network kanalları önde (soğuk e-posta, Instagram DM, LinkedIn, telefon, yüz yüze) */
export const CHANNEL: Record<string, string> = {
  email: "E-posta", instagram: "Instagram DM", linkedin: "LinkedIn", telefon: "Telefon", yuz_yuze: "Yüz yüze",
  whatsapp: "WhatsApp", r10: "R10 mesajı", diger: "Diğer",
};
/** Kanal noktası rengi */
export const CHANNEL_DOT: Record<string, string> = {
  email: "bg-entity-opportunity", instagram: "bg-entity-source", linkedin: "bg-chip-opportunity-fg", telefon: "bg-entity-payment",
  yuz_yuze: "bg-accent", whatsapp: "bg-success", r10: "bg-danger", diger: "bg-entity-neutral",
};
export const CHANNELS = Object.keys(CHANNEL);
/** Channels that get a daily outgoing message limit in Settings */
export const QUOTA_CHANNELS = ["email", "instagram", "linkedin", "whatsapp"];

/** Firma ve kişinin temas durumu (temaslarla ilerler; "olumsuz" ve "es geçildi" elle) */
export const CONTACT_STATUS: Record<string, string> = {
  yazilmadi: "Yazılmadı", yazildi: "Yazıldı", cevap_geldi: "Cevap geldi", gorusuldu: "Görüşüldü", olumsuz: "Olumsuz", es_gecildi: "Es geçildi", tanidik: "Tanıdık", arkadas: "Arkadaş",
};
export const CONTACT_STATUSES = Object.keys(CONTACT_STATUS);
/** People already known personally: no cold-outreach prompts for them */
export const isKnown = (status: string) => status === "tanidik" || status === "arkadas";
export const STATUS_TONE: Record<string, Tone> = { yazilmadi: "neutral", yazildi: "opportunity", cevap_geldi: "payment", gorusuldu: "success", olumsuz: "warning", es_gecildi: "neutral", tanidik: "source", arkadas: "success" };
export const STATUS_DOT: Record<string, string> = {
  yazilmadi: "bg-entity-neutral", yazildi: "bg-entity-opportunity", cevap_geldi: "bg-entity-payment", gorusuldu: "bg-accent", olumsuz: "bg-danger", es_gecildi: "bg-text-disabled", tanidik: "bg-entity-source", arkadas: "bg-entity-comment",
};

export const TARGET: Record<string, string> = {
  person: "Kişi", company: "Firma", opportunity: "Fırsat", project: "Proje", task: "Görev", draft: "Taslak", payment: "Ödeme",
  post: "Paylaşım", idea: "Fikir", own_project: "Kendi projesi",
};

export const ACTOR: Record<Actor, string> = { ozgur: "Özgür", claude: "Claude" };

// ---- Paket 2: pazarlama ----
export const PLATFORM: Record<string, string> = { r10: "R10", linkedin: "LinkedIn", instagram: "Instagram", diger: "Diğer" };
export const PLATFORMS = Object.keys(PLATFORM);
export const PLATFORM_DOT: Record<string, string> = { r10: "bg-danger", linkedin: "bg-chip-opportunity-fg", instagram: "bg-entity-source", diger: "bg-entity-neutral" };
export const TEMPLATE_KIND: Record<string, string> = { ilk: "İlk mesaj", takip: "Takip", teklif: "Teklif sonrası", diger: "Diğer" };
export const TEMPLATE_KINDS = Object.keys(TEMPLATE_KIND);
/** What a goal can count by itself besides a channel */
export const GOAL_METRIC: Record<string, string> = { new_records: "Yeni kayıt (kişi ve firma)" };
export const FUNNEL_STEP: Record<string, string> = { found: "Bulundu", written: "Yazıldı", replied: "Cevap", meeting: "Görüşme", offer: "Teklif", won: "Kazanıldı" };
/** Funnel period choices; the values are what the endpoint accepts */
export const FUNNEL_PERIODS = [{ value: "30", label: "Son 30 gün" }, { value: "90", label: "Son 90 gün" }, { value: "all", label: "Tümü" }];
export const IDEA_STAGE: Record<string, string> = { fikir: "Fikir", dogrulaniyor: "Doğrulanıyor", demo: "Demo", urun: "Ürün" };
export const IDEA_STAGES = Object.keys(IDEA_STAGE);
export const IDEA_TONE: Record<string, Tone> = { fikir: "neutral", dogrulaniyor: "payment", demo: "opportunity", urun: "success" };
// ---- Kendi projelerim ----
export const OWN_STATUS: Record<string, string> = { aktif: "Aktif", beklemede: "Beklemede", tamamlandi: "Tamamlandı", birakildi: "Bırakıldı" };
export const OWN_STATUSES = Object.keys(OWN_STATUS);
export const OWN_STATUS_TONE: Record<string, Tone> = { aktif: "success", beklemede: "payment", tamamlandi: "opportunity", birakildi: "neutral" };
export const SELLABLE: Record<string, string> = { evet: "Satılabilir", belki: "Belki satılır", hayir: "Satılmaz" };
export const SELLABLES = Object.keys(SELLABLE);
export const SELLABLE_TONE: Record<string, Tone> = { evet: "success", belki: "payment", hayir: "neutral" };
export const PRIORITY: Record<string, string> = { yuksek: "Yüksek", orta: "Orta", dusuk: "Düşük" };
export const PRIORITIES = Object.keys(PRIORITY);
export const PRIORITY_TONE: Record<string, Tone> = { yuksek: "warning", orta: "payment", dusuk: "neutral" };
export const INTEREST: Record<string, string> = { anlatildi: "Anlatıldı", ilgilendi: "İlgilendi", ilgilenmedi: "İlgilenmedi" };
export const INTEREST_TONE: Record<string, Tone> = { anlatildi: "neutral", ilgilendi: "success", ilgilenmedi: "warning" };

/** Yazar çipi */
export const WHO_CLS: Record<Actor, string> = {
  ozgur: "bg-author-ozgur-bg text-author-ozgur-fg",
  claude: "bg-claude-bg text-claude-soft",
};

/** Hap çip tonları */
export const TONE_CLS: Record<Tone, string> = {
  opportunity: "bg-chip-opportunity-bg text-chip-opportunity-fg",
  source: "bg-chip-source-bg text-chip-source-fg",
  payment: "bg-chip-payment-bg text-chip-payment-fg",
  warning: "bg-chip-warning-bg text-chip-warning-fg",
  neutral: "bg-chip-neutral-bg text-chip-neutral-fg",
  success: "bg-chip-success-bg text-chip-success-fg",
  claude: "bg-claude-bg text-claude-soft",
};

/** Etiket renkleri (veritabanındaki etiketin color alanı → token sınıfı) */
export const TAG_CLS: Record<string, string> = {
  aday: "bg-tag-aday-bg text-tag-aday-fg",
  musteri: "bg-tag-musteri-bg text-tag-musteri-fg",
  ajans: "bg-tag-ajans-bg text-tag-ajans-fg",
  is_ortagi: "bg-tag-is-ortagi-bg text-tag-is-ortagi-fg",
  network: "bg-tag-network-bg text-tag-network-fg",
  opportunity: TONE_CLS.opportunity,
  source: TONE_CLS.source,
  payment: TONE_CLS.payment,
  warning: TONE_CLS.warning,
  success: TONE_CLS.success,
};
export const TAG_COLORS = Object.keys(TAG_CLS);

/** Aşama noktası / çubuğu */
export const STAGE_BG: Record<OppStage, string> = {
  bulundu: "bg-stage-bulundu", temas: "bg-stage-temas", cevap: "bg-stage-cevap", gorusme: "bg-stage-gorusme",
  teklif: "bg-stage-teklif", kazanildi: "bg-stage-kazanildi", kaybedildi: "bg-stage-kaybedildi",
};
/** Aşama çipi tonu */
export const STAGE_TONE: Record<OppStage, Tone> = {
  bulundu: "neutral", temas: "opportunity", cevap: "opportunity", gorusme: "source", teklif: "payment", kazanildi: "success", kaybedildi: "warning",
};

/** Günlük iş planı: hafta günü kısa adları (ISO sırası, pazartesi önde) ve hazır tekrarlar */
/** Task kinds for the task form */
export const TASK_KIND_ITEMS: { value: "gorusme" | "takip" | "gorev"; label: string }[] = [
  { value: "gorev", label: "Görev" }, { value: "gorusme", label: "Görüşme" }, { value: "takip", label: "Takip" },
];
export const WEEKDAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const GOAL_PRESETS: { value: string; label: string; days: number[] }[] = [
  { value: "her_gun", label: "Her gün", days: [1, 2, 3, 4, 5, 6, 7] },
  { value: "hafta_ici", label: "Hafta içi", days: [1, 2, 3, 4, 5] },
];
/** "1,2,3,4,5" → "Hafta içi" ya da "Pzt Çar" */
export function daysLabel(days: string): string {
  const preset = GOAL_PRESETS.find((p) => p.days.join(",") === days);
  return preset ? preset.label : days.split(",").map((n) => WEEKDAY_SHORT[Number(n) - 1]).join(" ");
}

/** File picker filter for record files (the server checks the real type; the limits live in core FILE_LIMITS) */
export const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv,.docx,.pptx,.xlsx";
