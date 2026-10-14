import type { ListOpts } from "../context";

/** Kind of a task: a meeting, a follow-up or a plain task */
export type TaskKind = "gorusme" | "takip" | "gorev";

/** Who does a task: Özgür, Claude or the client (musteri) */
export type TaskAssignee = "ozgur" | "claude" | "musteri";

/** A task row as stored */
export interface TaskRecord {
  id: number;
  title: string;
  assignee: TaskAssignee;
  due_date: string | null;
  /** "HH:MM" or null */
  due_time: string | null;
  kind: TaskKind;
  done_at: string | null;
  person_id: number | null;
  company_id: number | null;
  opportunity_id: number | null;
  project_id: number | null;
  created_at: string;
  updated_at: string;
  created_by: "ozgur" | "claude";
}

/** A task as listed: the row plus the names of the record it hangs on */
export interface TaskListRow extends TaskRecord {
  person_name: string | null;
  company_name: string | null;
  opportunity_title: string | null;
  project_name: string | null;
}

/** The next open task of a project (project boards show it) */
export interface NextTask {
  id: number;
  title: string;
  due_date: string | null;
  assignee: string;
  created_by: string;
}

/** An open task of a project, as the project's waiting state reads it */
export interface OpenProjectTask {
  id: number;
  assignee: TaskAssignee;
  due_date: string | null;
}

/** A goal row as stored */
export interface GoalRecord {
  id: number;
  title: string;
  target: number;
  /** ISO weekdays, comma separated: "1,2,3,4,5" */
  days: string;
  channel: string | null;
  /** what the goal counts by itself instead of a channel ("new_records") */
  metric: string | null;
  note: string | null;
  created_at: string;
}

/** A goal's state on one day */
export interface GoalDay {
  id: number;
  title: string;
  target: number;
  channel: string | null;
  metric: string | null;
  manual: number;
  auto: number;
  /** new_records goals: duplicates skipped by bulk saves that day */
  duplicates: number;
  done: number;
  complete: boolean;
  /** the day's note */
  note: string | null;
  /** the goal's permanent note */
  goal_note: string | null;
}

export interface PlanTask {
  id: number;
  title: string;
  assignee: string;
  due_date: string | null;
  due_time: string | null;
  kind: TaskKind;
  done_at: string | null;
}

/** A task as the calendar feed lists it */
export type CalendarTask = Omit<PlanTask, "assignee">;

/** The day's plan: goals plus tasks due that day (today also lists overdue open tasks) */
export interface DayPlan {
  date: string;
  /** ISO weekday, 1 = Monday */
  weekday: number;
  goals: GoalDay[];
  tasks: PlanTask[];
  streak: number;
  week_ratio: number | null;
}

/** One day of the calendar feed: goals, tasks, payments and follow-ups due that day */
export interface CalendarDay {
  date: string;
  goals: GoalDay[];
  tasks: CalendarTask[];
  ratio: number | null;
  payments: { id: number; project_id: number; project_name: string; milestone: string; expected_amount: number; paid_amount: number; done: boolean; due_date: string }[];
  follow_ups: { type: "person" | "opportunity"; id: number; name: string; done: boolean; date: string }[];
}

/** Result of a write: the row and human readable effects */
export interface Saved<T> {
  row: T;
  effects: string[];
}

/** Result of a delete: how to undo it */
export interface Removed {
  effects: string[];
  trash: { type: string; id: number };
}

/**
 * Public API of the calendar module (`ctx.mod("calendar")`): tasks, daily goals and their progress,
 * the day plan and the calendar feed. The inputs are the same JSON the web and MCP send; they are validated inside.
 */
export interface CalendarApi {
  tasks: {
    create(input: unknown): Saved<TaskRecord>;
    /** Calendar quick add: `{ text, due_date? }`, "14:00 Elif ile görüşme" gives due_time 14:00 and kind gorusme */
    quick(input: unknown): Saved<TaskRecord>;
    /** `done: true` checks a task off */
    update(id: number, input: unknown): Saved<TaskRecord>;
    remove(id: number): Removed;
    list(opts: ListOpts): { rows: TaskListRow[]; total: number };
    /** the open task of a project that is due first */
    next(projectId: number): NextTask | null;
    /** the open tasks of these projects (one statement), each project's list in due order, undated last */
    openOfProjects(projectIds: number[]): Map<number, OpenProjectTask[]>;
  };
  goals: {
    create(input: unknown): Saved<GoalRecord>;
    update(id: number, input: unknown): Saved<GoalRecord>;
    remove(id: number): Removed;
    /** a day's progress: `{ goal_id, add | count, date?, note? }` */
    log(input: unknown): { row: unknown; effects: string[] };
    /** every goal with today's state */
    list(): (GoalRecord & { today: GoalDay | null })[];
  };
  /** the day's plan (date defaults to today) */
  plan(date?: string): DayPlan;
  /** goal fill rate, tasks, payments due and follow-ups due for every day in the range (at most 92 days) */
  calendar(from: string, to: string): CalendarDay[];
}
