import { z } from "zod";
import { docKit } from "@fullfollow/core";
import { TASK_ASSIGNEES } from "../service/constants";
import { goalCreate, goalLogInput, goalUpdate, taskCreate, taskQuick, taskUpdate } from "../service/schemas";

const { crud, defineDocs, flag, object, positiveInt, saveResult } = docKit;
const id = positiveInt.optional();
const date = z.string().optional().describe("YYYY-MM-DD");

/** API documentation of the calendar routes (`GET /api/docs`); the request shapes are the module's own Zod schemas */
export const docs = defineDocs({
  ...crud("/api/tasks", {
    noun: "task",
    filters: {
      all: flag("Open and done tasks (default: open only)"),
      done: flag("Only done tasks"),
      assignee: z.enum(TASK_ASSIGNEES).optional(),
      overdue: flag("Open tasks past their due date"),
      due: flag("Open tasks due today or earlier"),
      person_id: id, company_id: id, opportunity_id: id, project_id: id, idea_id: id,
    },
    create: taskCreate,
    update: taskUpdate,
  }),
  "GET /api/tasks/by-project": {
    summary: "List tasks grouped by project",
    query: z.object({ project_ids: z.string().optional().describe("Comma separated project ids (default: every project that has tasks)"), done: flag("Include done tasks") }),
    response: z.object({ rows: z.array(object) }),
  },
  "POST /api/tasks/quick": {
    summary: "Create a task from one line of text",
    description: "A time and a kind are read from the text: `14:00 Elif ile görüşme` gives due_time 14:00 and kind gorusme.",
    body: taskQuick,
    response: saveResult,
  },

  ...crud("/api/goals", { noun: "daily goal", create: goalCreate, update: goalUpdate }),
  "POST /api/goals/:id/log": {
    summary: "Log progress on a goal for a day",
    description: "`add` adds to the day's count, `count` sets it; the goal id comes from the path.",
    body: goalLogInput.omit({ goal_id: true }),
    response: saveResult,
  },
  "GET /api/plan": {
    summary: "Get the plan of a day",
    description: "The day's goals with their progress, the tasks due and the day's follow-ups.",
    query: z.object({ date }),
    response: object,
  },
  "GET /api/calendar": {
    summary: "Get the calendar feed for a date range",
    description: "Default range: the week of today, Monday to Sunday.",
    query: z.object({ from: date, to: date }),
    response: object,
  },
});
