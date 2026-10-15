import type { OwnProjectStage } from "@fullfollow/core";

/** The journey of an own project, in order */
export const OWN_STAGES = ["fikir", "dogrulama", "demo", "urun"] as const satisfies readonly OwnProjectStage[];

/** The idea priority whose open ideas are the project's next steps (the first priority of the ideas module) */
export const NEXT_STEP_PRIORITY = "yuksek";

/** Characters of a project name kept in an event summary (create, from an idea, delete) */
export const EVENT_NAME_CHARS = 60;
/** Characters of a project name kept in the update and status event summaries */
export const UPDATE_NAME_CHARS = 50;
