import { OPEN_OPP_STAGES } from "../constants";
import { rows, type Ctx } from "../context";

export interface DuePayment {
  id: number;
  project_id: number;
  project_name: string;
  milestone: string;
  expected_amount: number;
  paid_amount: number;
  done: boolean;
}

export interface DueFollowUp {
  type: "person" | "opportunity";
  id: number;
  name: string;
  /** an outgoing touch on or after the follow-up date */
  done: boolean;
}

/** Task order inside a day: timed ones by time, the rest after them */
export const TASK_ORDER_SQL = "(due_time IS NULL), due_time, id";

/** Payments whose due date falls in the range (paid ones too, they show as done) */
export function paymentsDue(ctx: Ctx, from: string, to: string): (DuePayment & { due_date: string })[] {
  return rows(ctx, `SELECT p.id, p.project_id, pr.name AS project_name, p.milestone, p.expected_amount, p.paid_amount, p.due_date, p.paid_amount >= p.expected_amount AS done
    FROM payments p JOIN projects pr ON pr.id = p.project_id WHERE p.due_date BETWEEN ? AND ? ORDER BY p.id`, from, to)
    .map((r) => ({ ...r, done: !!r.done }));
}

/** Follow-up dates of people and open opportunities in the range */
export function followUpsDue(ctx: Ctx, from: string, to: string): (DueFollowUp & { date: string })[] {
  const open = OPEN_OPP_STAGES.map(() => "?").join(",");
  const people = rows<DueFollowUp & { date: string }>(ctx, `SELECT 'person' AS type, p.id, p.name, substr(p.next_follow_up_at, 1, 10) AS date,
      EXISTS (SELECT 1 FROM touches t WHERE t.person_id = p.id AND t.direction = 'giden' AND substr(t.happened_at, 1, 10) >= substr(p.next_follow_up_at, 1, 10)) AS done
    FROM people p WHERE substr(p.next_follow_up_at, 1, 10) BETWEEN ? AND ?`, from, to);
  const opps = rows<DueFollowUp & { date: string }>(ctx, `SELECT 'opportunity' AS type, o.id, o.title AS name, substr(o.next_follow_up_at, 1, 10) AS date,
      EXISTS (SELECT 1 FROM touches t WHERE (t.opportunity_id = o.id OR t.person_id = o.person_id) AND t.direction = 'giden' AND substr(t.happened_at, 1, 10) >= substr(o.next_follow_up_at, 1, 10)) AS done
    FROM opportunities o WHERE o.stage IN (${open}) AND substr(o.next_follow_up_at, 1, 10) BETWEEN ? AND ?`, ...OPEN_OPP_STAGES, from, to);
  return [...people, ...opps].map((r) => ({ ...r, done: !!r.done }));
}
