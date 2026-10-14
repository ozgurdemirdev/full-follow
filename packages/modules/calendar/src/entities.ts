import { FFError, type EntityHandler } from "@fullfollow/core";
import { goalsService } from "./service/goals";
import { tasksService } from "./service/tasks";

const WHOLE = { limit: 100000 };

/** The record types the calendar owns, for the generic save / find / get / delete (the web and MCP use these names) */
export const entities: Record<string, EntityHandler> = {
  task: {
    aliases: ["gorev", "görev"],
    related: ["comments"],
    save: (ctx, d, id) => (id ? tasksService(ctx).update(id, d) : tasksService(ctx).create(d)),
    get: (ctx, id) => tasksService(ctx).list({ filter: { all: true }, ...WHOLE }).rows.find((t) => t.id === id),
    find: (ctx, o) => tasksService(ctx).list(o),
    delete: (ctx, id) => tasksService(ctx).remove(id),
  },
  goal: {
    aliases: ["hedef", "hedefler", "goals"],
    ref: { table: "daily_goals", col: "title", label: "hedef" },
    save: (ctx, d, id) => (id ? goalsService(ctx).update(id, d) : goalsService(ctx).create(d)),
    get: (ctx, id) => goalsService(ctx).find(WHOLE).rows.find((g) => g.id === id),
    find: (ctx, o) => goalsService(ctx).find(o),
    delete: (ctx, id) => goalsService(ctx).remove(id),
  },
  goal_log: {
    aliases: ["ilerleme", "progress"],
    save: (ctx, d, id) => goalsService(ctx).log(id ? { ...d, goal_id: id } : d),
    get: (ctx, id) => goalsService(ctx).logList(WHOLE).rows.find((l) => l.id === id),
    find: (ctx, o) => goalsService(ctx).logList(o),
    delete: () => {
      throw new FFError("validation", "ilerleme silinmez; count:0 ile sıfırla");
    },
  },
};
