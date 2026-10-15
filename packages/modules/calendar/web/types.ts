// The calendar module's own API types (the Today shell sections Plan, GoalDay, PlanTask and Task stay in the kit's api/types.ts)
import type { Base, GoalDay, PlanTask } from "@kit/api/types";

/** A payment due on a calendar day */
export interface DuePayment {
  id: number;
  project_id: number;
  project_name: string;
  milestone: string;
  expected_amount: number;
  paid_amount: number;
  done: boolean;
}
/** A follow-up date of a person or an open opportunity */
export interface DueFollowUp {
  type: "person" | "opportunity";
  id: number;
  name: string;
  done: boolean;
}
/** `GET /api/calendar?from&to`: one entry per day */
export interface CalendarDay {
  date: string;
  goals: GoalDay[];
  tasks: Omit<PlanTask, "assignee">[];
  ratio: number | null;
  payments: DuePayment[];
  follow_ups: DueFollowUp[];
}
/** `GET /api/goals/:id` */
export interface Goal extends Base {
  title: string;
  target: number;
  days: string;
  channel: string | null;
  metric: string | null;
  note: string | null;
}
