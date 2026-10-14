import type { Ctx } from "@fullfollow/core";
import { goalsService } from "./goals";
import { tasksService } from "./tasks";

const cache = new WeakMap<Ctx, { tasks: ReturnType<typeof tasksService>; goals: ReturnType<typeof goalsService> }>();

/** The calendar's services, built once per context (the context lives as long as its app; the WeakMap holds nothing beyond it) */
export function calendarServices(ctx: Ctx) {
  let s = cache.get(ctx);
  if (!s) cache.set(ctx, (s = { tasks: tasksService(ctx), goals: goalsService(ctx) }));
  return s;
}
