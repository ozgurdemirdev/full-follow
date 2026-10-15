import type { IdeaStage } from "@fullfollow/core";

/** Answers (interested or not) the numbers need before they say anything about an idea */
export const VERDICT_MIN_ANSWERS = 3;
/** Share of the answers that were interested: from RATE_STRONG the signal is strong, from RATE_MIXED it is mixed, below it weak */
export const RATE_STRONG = 0.6;
export const RATE_MIXED = 0.4;
/** Stages that still want a demo before a project */
export const EARLY_STAGES: readonly IdeaStage[] = ["fikir", "dogrulaniyor"];

/** Words that name the idea and interest record types in the generic tools */
export const IDEA_ALIASES = ["fikir", "ideas"];
export const INTEREST_ALIASES = ["ilgi"];
/** Longest idea title written into an event summary: most events, and the edit event */
export const EVENT_TITLE_SHORT = 50;
export const EVENT_TITLE_LENGTH = 60;
/** MCP output: lengths of the text parts of a line, of an idea title in the marketing report, and how many ideas that report names */
export const MCP_TEXT_LENGTH = 50;
export const MCP_TITLE_LENGTH = 30;
export const MCP_MARKETING_IDEAS = 5;
