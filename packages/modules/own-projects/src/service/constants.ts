import type { OwnProjectStage } from "@fullfollow/core";

/** The journey of an own project, in order */
export const OWN_STAGES = ["fikir", "dogrulama", "demo", "urun"] as const satisfies readonly OwnProjectStage[];

/** The idea priority whose open ideas are the project's next steps (the first priority of the ideas module) */
export const NEXT_STEP_PRIORITY = "yuksek";
