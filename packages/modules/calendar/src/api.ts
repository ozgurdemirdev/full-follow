import type { CalendarApi, Ctx } from "@fullfollow/core";
import { goalsService } from "./service/goals";
import { tasksService } from "./service/tasks";

/** The calendar module's implementation of its contract (`CalendarApi` in core's contracts) */
export function calendarApi(ctx: Ctx): CalendarApi {
  const goals = goalsService(ctx);
  return {
    // task rows come from text columns (the schema stays free of module enums); the contract narrows kind and assignee
    tasks: tasksService(ctx) as CalendarApi["tasks"],
    goals: { create: goals.create, update: goals.update, remove: goals.remove, log: goals.log, list: goals.list },
    plan: goals.plan,
    calendar: goals.calendar,
  };
}
