import { OPEN_STAGES, type OppStage } from "@kit/lib/labels";
import { m } from "./messages";

/** The stages of the board: the open ones, then won */
export const BOARD_STAGES: OppStage[] = [...OPEN_STAGES, "kazanildi"];

/** Role of an extra person on an opportunity, in display order */
export const OPP_ROLE: Record<string, string> = m.roles;
export const OPP_ROLES = Object.keys(OPP_ROLE);

/** The steps of the source funnel report */
export const FUNNEL_STEP: Record<string, string> = m.funnelSteps;
/** Funnel period choices; the values are what the endpoint accepts */
export const FUNNEL_PERIODS = [{ value: "30", label: m.funnelPeriods.d30 }, { value: "90", label: m.funnelPeriods.d90 }, { value: "all", label: m.funnelPeriods.all }];

/** Aşama noktası / çubuğu */
export const STAGE_BG: Record<OppStage, string> = {
  bulundu: "bg-stage-bulundu", temas: "bg-stage-temas", cevap: "bg-stage-cevap", gorusme: "bg-stage-gorusme",
  teklif: "bg-stage-teklif", kazanildi: "bg-stage-kazanildi", kaybedildi: "bg-stage-kaybedildi",
};
