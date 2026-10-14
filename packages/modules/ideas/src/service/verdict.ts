import type { IdeaStage, IdeaStats } from "@fullfollow/core";
import { EARLY_STAGES, RATE_MIXED, RATE_STRONG, VERDICT_MIN_ANSWERS, VERDICT_TEXT } from "./constants";

type Counts = { told: number; interested: number; not_interested: number; stage: IdeaStage };
type Verdict = Pick<IdeaStats, "answered" | "interest_share" | "rate_tone" | "verdict">;

/** The share of answers that were interested, how strong that is, and the sentence for it. The unanswered do not count in the share. */
export function judge(i: Counts): Verdict {
  const answered = i.interested + i.not_interested;
  const interest_share = answered ? i.interested / answered : null;
  const rate_tone = interest_share === null ? null : interest_share >= RATE_STRONG ? "strong" : interest_share >= RATE_MIXED ? "mixed" : "weak";
  let verdict: string;
  if (rate_tone === null || answered < VERDICT_MIN_ANSWERS) verdict = VERDICT_TEXT.tooFew(i.told - answered);
  else if (rate_tone === "strong") verdict = EARLY_STAGES.includes(i.stage) ? VERDICT_TEXT.strongEarly : VERDICT_TEXT.strongLate;
  else verdict = VERDICT_TEXT[rate_tone];
  return { answered, interest_share, rate_tone, verdict };
}
