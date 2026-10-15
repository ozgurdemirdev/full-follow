import { OPEN_STAGES, type OppStage } from "@kit/lib/labels";

/** The stages of the board: the open ones, then won */
export const BOARD_STAGES: OppStage[] = [...OPEN_STAGES, "kazanildi"];

/** Role of an extra person on an opportunity, in display order */
export const OPP_ROLE: Record<string, string> = { karar_verici: "Karar verici", teknik: "Teknik", ortak: "Ortak", diger: "Diğer" };
export const OPP_ROLES = Object.keys(OPP_ROLE);

/** The steps of the source funnel report */
export const FUNNEL_STEP: Record<string, string> = { found: "Bulundu", written: "Yazıldı", replied: "Cevap", meeting: "Görüşme", offer: "Teklif", won: "Kazanıldı" };
/** Funnel period choices; the values are what the endpoint accepts */
export const FUNNEL_PERIODS = [{ value: "30", label: "Son 30 gün" }, { value: "90", label: "Son 90 gün" }, { value: "all", label: "Tümü" }];

/** Aşama noktası / çubuğu */
export const STAGE_BG: Record<OppStage, string> = {
  bulundu: "bg-stage-bulundu", temas: "bg-stage-temas", cevap: "bg-stage-cevap", gorusme: "bg-stage-gorusme",
  teklif: "bg-stage-teklif", kazanildi: "bg-stage-kazanildi", kaybedildi: "bg-stage-kaybedildi",
};
