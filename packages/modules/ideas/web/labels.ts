import { IDEA_STAGE, type Tone } from "@kit/lib/labels";

export const IDEA_STAGES = Object.keys(IDEA_STAGE);
export const PRIORITY: Record<string, string> = { yuksek: "Yüksek", orta: "Orta", dusuk: "Düşük" };
export const PRIORITIES = Object.keys(PRIORITY);
export const INTEREST: Record<string, string> = { anlatildi: "Anlatıldı", ilgilendi: "İlgilendi", ilgilenmedi: "İlgilenmedi" };
export const INTEREST_TONE: Record<string, Tone> = { anlatildi: "neutral", ilgilendi: "success", ilgilenmedi: "warning" };
