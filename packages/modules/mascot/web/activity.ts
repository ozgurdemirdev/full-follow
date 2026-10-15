// What the chat is doing, as the mascot shows it (packet E). Pure data and no Three.js, so Mascot.tsx can use it without the 3D chunk.
import type { ChatPhase } from "@kit/api/chat";

export type Activity = "idle" | "queued" | "thinking" | "search" | "work" | "writing" | "error";

/** Tools that only read or look: the mascot searches. Every other tool changes something: it works. */
const SEARCH_TOOLS = new Set(["find", "get", "timeline", "today", "report", "open", "ToolSearch", "WebSearch", "WebFetch"]);

/** The single mapping from the live chat state to an activity; a finished reply is not here (done cheers, error is timed by the caller) */
export const CHAT_ACTIVITY: Record<Exclude<ChatPhase, "tool">, Activity> = { queued: "queued", thinking: "thinking", writing: "writing" };

export function activityOf(live: { running: boolean; phase: ChatPhase | null; tool: string | null }): Activity {
  if (!live.running || !live.phase) return "idle";
  if (live.phase !== "tool") return CHAT_ACTIVITY[live.phase];
  return SEARCH_TOOLS.has(live.tool ?? "") ? "search" : "work";
}

/** A candidate that must stay the same for `minMs` before it replaces the shown activity */
export interface Debounce { shown: Activity; cand: Activity; since: number }
export const newDebounce = (): Debounce => ({ shown: "idle", cand: "idle", since: 0 });

/** Returns the activity to show now; `now` in ms */
export function settle(d: Debounce, want: Activity, now: number, minMs: number): Activity {
  if (want !== d.cand) {
    d.cand = want;
    d.since = now;
  }
  if (d.cand !== d.shown && now - d.since >= minMs) d.shown = d.cand;
  return d.shown;
}
