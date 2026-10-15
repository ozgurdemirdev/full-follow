import { OPEN_STAGES, type OppStage } from "@kit/lib/labels";

/** The stages of the board: the open ones, then won */
export const BOARD_STAGES: OppStage[] = [...OPEN_STAGES, "kazanildi"];

/** Role of an extra person on an opportunity, in display order */
export const OPP_ROLE: Record<string, string> = { karar_verici: "Karar verici", teknik: "Teknik", ortak: "Ortak", diger: "Diğer" };
export const OPP_ROLES = Object.keys(OPP_ROLE);

/** Aşama noktası / çubuğu */
export const STAGE_BG: Record<OppStage, string> = {
  bulundu: "bg-stage-bulundu", temas: "bg-stage-temas", cevap: "bg-stage-cevap", gorusme: "bg-stage-gorusme",
  teklif: "bg-stage-teklif", kazanildi: "bg-stage-kazanildi", kaybedildi: "bg-stage-kaybedildi",
};
