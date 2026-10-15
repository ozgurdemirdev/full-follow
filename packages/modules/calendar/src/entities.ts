import { FFError, type EntityHandler } from "@fullfollow/core";
import { m } from "./messages";
import { calendarServices } from "./service";
import { ALL_ROWS, TASK_ALIASES } from "./service/constants";

const WHOLE = { limit: ALL_ROWS };

/** The record types the calendar owns, for the generic save / find / get / delete (the web and MCP use these names) */
export const entities: Record<string, EntityHandler> = {
  task: {
    aliases: TASK_ALIASES,
    related: ["comments"],
    save: (ctx, d, id) => (id ? calendarServices(ctx).tasks.update(id, d) : calendarServices(ctx).tasks.create(d)),
    get: (ctx, id) => calendarServices(ctx).tasks.list({ filter: { all: true }, ...WHOLE }).rows.find((t) => t.id === id),
    find: (ctx, o) => calendarServices(ctx).tasks.list(o),
    delete: (ctx, id) => calendarServices(ctx).tasks.remove(id),
  },
  goal: {
    aliases: ["hedef", "hedefler", "goals"],
    ref: { table: "daily_goals", col: "title", label: m.goal },
    save: (ctx, d, id) => (id ? calendarServices(ctx).goals.update(id, d) : calendarServices(ctx).goals.create(d)),
    get: (ctx, id) => calendarServices(ctx).goals.find(WHOLE).rows.find((g) => g.id === id),
    find: (ctx, o) => calendarServices(ctx).goals.find(o),
    delete: (ctx, id) => calendarServices(ctx).goals.remove(id),
  },
  goal_log: {
    aliases: ["ilerleme", "progress"],
    save: (ctx, d, id) => calendarServices(ctx).goals.log(id ? { ...d, goal_id: id } : d),
    get: (ctx, id) => calendarServices(ctx).goals.logList(WHOLE).rows.find((l) => l.id === id),
    find: (ctx, o) => calendarServices(ctx).goals.logList(o),
    delete: () => {
      throw new FFError("validation", m.errors.logNotDeletable);
    },
  },
};
