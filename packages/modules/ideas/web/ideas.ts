import { run } from "@kit/api/actions";
import type { Idea, IdeaStage, InterestLevel } from "@kit/api/types";
import { todayIso } from "@kit/lib/format";

/** The four lanes, left to right: the stage order of an idea */
export const IDEA_FLOW: readonly IdeaStage[] = ["fikir", "dogrulaniyor", "demo", "urun"];

/** The title of the task that asks Claude for a pitch text; the idea is the task's link */
const PITCH_TASK_TITLE = "Fikir için kısa anlatım metni hazırla";

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

/** Ask Claude for a short pitch text: a task for Claude linked to the idea (the draft lands in Taslaklar) */
export const askPitch = (i: Pick<Idea, "id">) =>
  run("post", "/tasks", { title: PITCH_TASK_TITLE, idea_id: i.id, assignee: "claude", due_date: todayIso() }, { ok: "Kısa anlatım metni Taslaklar’a düşecek" });

export type Lane = { stage: IdeaStage; ideas: Idea[] };

/** Ideas grouped into the lanes, in flow order; every lane exists even when it is empty */
export function groupByStage(rows: readonly Idea[]): Lane[] {
  const lanes: Lane[] = IDEA_FLOW.map((stage) => ({ stage, ideas: [] }));
  for (const i of rows) lanes.find((l) => l.stage === i.stage)?.ideas.push(i);
  return lanes;
}
