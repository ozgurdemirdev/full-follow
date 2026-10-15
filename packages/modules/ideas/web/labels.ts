import { IDEA_STAGE, type Tone } from "@kit/lib/labels";
import { m } from "./messages";

export const IDEA_STAGES = Object.keys(IDEA_STAGE);
export const PRIORITY: Record<string, string> = m.priorities;
export const PRIORITIES = Object.keys(PRIORITY);
export const INTEREST: Record<string, string> = m.interest;
export const INTEREST_TONE: Record<string, Tone> = { anlatildi: "neutral", ilgilendi: "success", ilgilenmedi: "warning" };
