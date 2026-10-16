import type { Idea, IdeaStage, InterestLevel } from "@kit/api/types";
import type { ClaudeRequest } from "@kit/lib/askClaude";
import { m } from "./messages";

/** The four lanes, left to right: the stage order of an idea */
export const IDEA_FLOW: readonly IdeaStage[] = ["fikir", "dogrulaniyor", "demo", "urun"];

/** Interest dots drawn on a lane card */
export const DOTS_MAX = 8;

/** Reaction shown after a tap on a person's state: Anlatıldı, İlgilendi, İlgilenmedi, then around */
export const NEXT_INTEREST: Record<InterestLevel, InterestLevel> = { anlatildi: "ilgilendi", ilgilendi: "ilgilenmedi", ilgilenmedi: "anlatildi" };

/** Lane card rate is shown as healthy from this share of interested answers (the strength of the signal itself is the module's `rate_tone`) */
export const LANE_RATE_GOOD = 0.5;

export type Reaction = "yes" | "no" | "told";


/** One dot per person, interested first, capped at DOTS_MAX */
export function dotsOf(i: Pick<Idea, "told" | "interested" | "not_interested" | "answered">): Reaction[] {
  return [
    ...Array<Reaction>(i.interested).fill("yes"),
    ...Array<Reaction>(i.not_interested).fill("no"),
    ...Array<Reaction>(Math.max(0, i.told - i.answered)).fill("told"),
  ].slice(0, DOTS_MAX);
}

/** The request for Claude to write a short pitch text for the idea (the draft lands in Taslaklar) */
export const pitchRequest = (i: Pick<Idea, "id">): ClaudeRequest => ({ title: m.pitch.taskTitle, target: { idea_id: i.id }, ok: m.pitch.queued, draft: true });

export type Lane = { stage: IdeaStage; ideas: Idea[] };

/** Ideas grouped into the lanes, in flow order; every lane exists even when it is empty */
export function groupByStage(rows: readonly Idea[]): Lane[] {
  const lanes: Lane[] = IDEA_FLOW.map((stage) => ({ stage, ideas: [] }));
  for (const i of rows) lanes.find((l) => l.stage === i.stage)?.ideas.push(i);
  return lanes;
}
