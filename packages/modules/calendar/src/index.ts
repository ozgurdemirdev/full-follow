import { defineModule, type RecordTrashed } from "@fullfollow/core";
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
  hooks: {
    // the tasks that hang on a record that goes to the trash: a person's go with it (and the comments on them), the link from a company, opportunity or project is emptied
    "record.trashed": (_ctx, { type, id, bin }: RecordTrashed) => {
      if (type === "person") {
        bin.take("comments", "target_type = 'task' AND target_id IN (SELECT id FROM tasks WHERE person_id = ?)", id);
        bin.take("tasks", "person_id = ?", id);
      } else if (type === "company") bin.unlink("tasks", "company_id", id);
      else if (type === "opportunity") bin.unlink("tasks", "opportunity_id", id);
      else if (type === "project") bin.unlink("tasks", "project_id", id);
    },
  },
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
