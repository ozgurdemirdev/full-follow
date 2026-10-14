import { defineModule } from "@fullfollow/core";
import { calendarApi } from "./api";
import { entities } from "./entities";
import { mcp } from "./mcp";

export { parseQuickTask, taskKindOf, type QuickTask } from "./service/quickAdd";

/**
 * Calendar: tasks, daily goals and their progress, the day plan and the calendar feed.
 * Its tables (tasks, daily_goals, goal_logs) stay in core's schema; removing this package leaves their rows in place.
 */
export default defineModule({
  key: "calendar",
  label: "Takvim",
  uses: ["projects", "drafts"],
  api: calendarApi,
  entities,
  contribute: {
    trashTypes: [{ type: "task", label: "görev" }, { type: "goal", label: "hedef" }],
    // the day plan and the tasks due today, on the Today view
    today: (ctx, { limit }) => {
      const cal = ctx.mod("calendar")!;
      return { plan: cal.plan(), tasks: cal.tasks.list({ limit, filter: { due: true } }) };
    },
    // `get(person | opportunity | project, id, with: ["tasks"])`
    relations: {
      tasks: { on: ["person", "opportunity", "project"], load: (ctx, by, limit) => ctx.mod("calendar")!.tasks.list({ filter: by, limit }).rows.slice(0, limit) },
    },
  },
  mcp,
});
