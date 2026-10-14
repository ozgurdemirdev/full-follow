import { run } from "../api/actions";
import type { IdeaRow, IdeaStage, InterestLevel } from "../api/types";
import { todayIso } from "./format";

/** The four lanes, left to right: the stage order of an idea */
export const IDEA_FLOW: readonly IdeaStage[] = ["fikir", "dogrulaniyor", "demo", "urun"];

/** Interest dots drawn on a lane card */
export const DOTS_MAX = 8;

/** Reaction shown after a tap on a person's state: Anlatıldı, İlgilendi, İlgilenmedi, then around */
export const NEXT_INTEREST: Record<InterestLevel, InterestLevel> = { anlatildi: "ilgilendi", ilgilendi: "ilgilenmedi", ilgilenmedi: "anlatildi" };

// ---- verdict rule. Rule based, moves into core with the ideas module (thresholds then live in constants.ts) ----
/** Answers (interested or not) needed before the numbers say anything */
export const VERDICT_MIN_ANSWERS = 3;
/** Interest rate from which the signal is strong, and from which it is mixed (share of answers that were interested) */
export const RATE_STRONG = 0.6;
export const RATE_MIXED = 0.4;
/** Lane card rate is shown as healthy from this rate */
export const LANE_RATE_GOOD = 0.5;
/** Stages that still want a demo before a project */
const EARLY_STAGES: readonly IdeaStage[] = ["fikir", "dogrulaniyor"];

export type Reaction = "yes" | "no" | "told";
export type RateTone = "strong" | "mixed" | "weak";

type Counts = Pick<IdeaRow, "told" | "interested" | "not_interested">;

/** People who gave an answer: interested or not */
export const answered = (i: Counts) => i.interested + i.not_interested;

/** Share of the answers that were interested; null while nobody has answered (the API rate counts the unanswered too, so it is not used) */
export const rateOf = (i: Counts): number | null => (answered(i) ? i.interested / answered(i) : null);

export const ratePct = (rate: number) => Math.round(rate * 100);

export const rateTone = (rate: number): RateTone => (rate >= RATE_STRONG ? "strong" : rate >= RATE_MIXED ? "mixed" : "weak");

/** One dot per person, interested first, capped at DOTS_MAX */
export function dotsOf(i: Counts): Reaction[] {
  const pending = i.told - answered(i);
  return [
    ...Array<Reaction>(i.interested).fill("yes"),
    ...Array<Reaction>(i.not_interested).fill("no"),
    ...Array<Reaction>(Math.max(0, pending)).fill("told"),
  ].slice(0, DOTS_MAX);
}

/** The sentence under the ring */
export function verdictOf(i: Counts & Pick<IdeaRow, "stage">): string {
  const rate = rateOf(i);
  if (rate === null || answered(i) < VERDICT_MIN_ANSWERS) return `Karar için az. En az ${VERDICT_MIN_ANSWERS} kişiden cevap al; ${i.told - answered(i)} kişi henüz dönmedi.`;
  if (rate >= RATE_STRONG) return `İlgi güçlü. ${EARLY_STAGES.includes(i.stage) ? "Demo aşamasına geçip küçük bir örnek göster." : "Projeye dönüştürmek için yeterli sinyal var."}`;
  if (rate >= RATE_MIXED) return "Karışık. İlgilenmeyenlerin nedenine bak, fiyat mı ihtiyaç mı?";
  return "İlgi zayıf. Bırakmayı ya da kime anlattığını değiştirmeyi düşün.";
}

/** Ask Claude for a short pitch text (a task for Claude; the draft lands in Taslaklar) */
export const askPitch = (i: Pick<IdeaRow, "title">) =>
  run("post", "/tasks", { title: `“${i.title}” fikri için kısa anlatım metni hazırla`, assignee: "claude", due_date: todayIso() }, { ok: "Kısa anlatım metni Taslaklar’a düşecek" });

export type Lane = { stage: IdeaStage; ideas: IdeaRow[] };

/** Ideas grouped into the lanes, in flow order; every lane exists even when it is empty */
export function groupByStage(rows: readonly IdeaRow[]): Lane[] {
  const lanes: Lane[] = IDEA_FLOW.map((stage) => ({ stage, ideas: [] }));
  for (const i of rows) lanes.find((l) => l.stage === i.stage)?.ideas.push(i);
  return lanes;
}
