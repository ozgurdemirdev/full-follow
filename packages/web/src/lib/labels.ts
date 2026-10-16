// Ekranda görünen adlar ve token sınıf eşlemeleri.
// Tailwind sınıfları derleme anında tarandığı için tam sınıf adları burada açıkça yazılır.
import { labels } from "../messages.labels";
import { ownerLabel } from "./owner";

export type Actor = "owner" | "claude";
export type OppStage = "bulundu" | "temas" | "cevap" | "gorusme" | "teklif" | "kazanildi" | "kaybedildi";
export type ProjectStage = "pesinat" | "tasarim_onayi" | "test_surumu" | "yayin" | "teslim" | "bakim" | "iptal";
export type PostFormat = "metin" | "gorsel" | "video" | "karusel";
export type Tone = "opportunity" | "source" | "payment" | "warning" | "neutral" | "success" | "claude";

export const OPEN_STAGES: OppStage[] = ["bulundu", "temas", "cevap", "gorusme", "teklif"];
export const PROJECT_STEPS: ProjectStage[] = ["pesinat", "tasarim_onayi", "test_surumu", "yayin", "teslim", "bakim"];

export const STAGE: Record<OppStage, string> = labels.stage;
export const PROJECT_STAGE: Record<ProjectStage, string> = labels.projectStage;
export const MILESTONE: Record<string, string> = { ...PROJECT_STAGE };

/** Network kanalları önde (soğuk e-posta, Instagram DM, LinkedIn, telefon, yüz yüze) */
export const CHANNEL: Record<string, string> = labels.channel;
export const CHANNELS = Object.keys(CHANNEL);

/** Firma ve kişinin temas durumu (temaslarla ilerler; "olumsuz" ve "es geçildi" elle) */
export const CONTACT_STATUS: Record<string, string> = labels.contactStatus;
export const CONTACT_STATUSES = Object.keys(CONTACT_STATUS);
export const STATUS_TONE: Record<string, Tone> = { yazilmadi: "neutral", yazildi: "opportunity", cevap_geldi: "payment", gorusuldu: "success", olumsuz: "warning", es_gecildi: "neutral", tanidik: "source", arkadas: "success" };

export const TARGET: Record<string, string> = labels.target;

/** Author names: the owner's is read each time a label is drawn, so it follows the name given in the setup or in Settings */
export const ACTOR: Record<Actor, string> = {
  get owner() {
    return ownerLabel();
  },
  claude: labels.actor.claude,
};

// ---- Paket 2: pazarlama ----
export const PLATFORM: Record<string, string> = labels.platform;
export const TEMPLATE_KIND: Record<string, string> = labels.templateKind;
export const IDEA_STAGE: Record<string, string> = labels.ideaStage;

/** Yazar çipi */
export const WHO_CLS: Record<Actor, string> = {
  owner: "bg-author-owner-bg text-author-owner-fg",
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

/** Aşama çipi tonu */
export const STAGE_TONE: Record<OppStage, Tone> = {
  bulundu: "neutral", temas: "opportunity", cevap: "opportunity", gorusme: "source", teklif: "payment", kazanildi: "success", kaybedildi: "warning",
};

/** Who a task belongs to: the owner, Claude, or the client (the project then waits on the client) */
export type TaskAssignee = Actor | "musteri";
export const ASSIGNEE: Record<TaskAssignee, string> = labels.assignee;

/** Weekday short names (ISO order, Monday first) */
export const WEEKDAY_SHORT = Object.values(labels.weekdayShort);

/** File picker filter for record files (the server checks the real type; the limits live in core FILE_LIMITS) */
export const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv,.docx,.pptx,.xlsx";
