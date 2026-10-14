import { createCore, createRegistry, type Actor, type Clock, type DbHandle } from "@fullfollow/core";
import calendar from "../src";

/** A core with the calendar module installed, plus its API shorthands (`tasks`, `goals`) the tests read naturally with */
export function appFor(handle: DbHandle, actor: Actor, clock?: Clock) {
  const core = createCore(handle, actor, clock, createRegistry([calendar]));
  const cal = core.mod("calendar")!;
  return Object.assign(core, { tasks: cal.tasks, goals: { ...cal.goals, plan: cal.plan, calendar: cal.calendar } });
}
export type TestApp = ReturnType<typeof appFor>;
