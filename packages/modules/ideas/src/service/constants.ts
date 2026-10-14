import type { IdeaStage } from "@fullfollow/core";

/** Answers (interested or not) the numbers need before they say anything about an idea */
export const VERDICT_MIN_ANSWERS = 3;
/** Share of the answers that were interested: from RATE_STRONG the signal is strong, from RATE_MIXED it is mixed, below it weak */
export const RATE_STRONG = 0.6;
export const RATE_MIXED = 0.4;
/** Stages that still want a demo before a project */
export const EARLY_STAGES: readonly IdeaStage[] = ["fikir", "dogrulaniyor"];

/** The sentences of the verdict */
export const VERDICT_TEXT = {
  tooFew: (pending: number) => `Karar için az. En az ${VERDICT_MIN_ANSWERS} kişiden cevap al; ${pending} kişi henüz dönmedi.`,
  strongEarly: "İlgi güçlü. Demo aşamasına geçip küçük bir örnek göster.",
  strongLate: "İlgi güçlü. Projeye dönüştürmek için yeterli sinyal var.",
  mixed: "Karışık. İlgilenmeyenlerin nedenine bak, fiyat mı ihtiyaç mı?",
  weak: "İlgi zayıf. Bırakmayı ya da kime anlattığını değiştirmeyi düşün.",
} as const;
