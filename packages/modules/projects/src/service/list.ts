import {
  addDays, bool, has, keptRow, keptRows, page, rows,
  type CompanyProjectMoney, type Ctx, type DuePayment, type ListOpts, type NextPayment, type PaymentRow, type PersonProjectStats, type ProjectRef, type ProjectRow,
} from "@fullfollow/core";
import { CANCELLED_STAGE, NOT_CANCELLED } from "./constants";
import { paymentStatus } from "./payments";
import { waitingOf } from "./waiting";

const PROJECT_SELECT = `
  SELECT pr.*, pe.name AS person_name,
    (SELECT COALESCE(SUM(paid_amount),0) FROM payments WHERE project_id = pr.id) AS paid_total,
    (SELECT COALESCE(SUM(expected_amount),0) FROM payments WHERE project_id = pr.id) AS expected_total
  FROM projects pr JOIN people pe ON pe.id = pr.person_id`;

type Listed = Omit<ProjectRow, "next_payment" | "next_task" | "waiting" | "waiting_amount">;

/** For the project board: the next unpaid payment, the next open task (null without the calendar module) and who the project waits on */
function withNext(ctx: Ctx, list: Listed[]): ProjectRow[] {
  const waiting = waitingOf(ctx, list.map((p) => p.id));
  return list.map((p) => {
    const np = p.stage === CANCELLED_STAGE ? undefined : keptRow<NextPayment>(ctx, `SELECT id, milestone, expected_amount - paid_amount AS remaining, due_date FROM payments
      WHERE project_id = ? AND paid_amount < expected_amount ORDER BY (due_date IS NULL), due_date, id LIMIT 1`, p.id);
    return { ...p, next_payment: np ?? null, next_task: ctx.mod("calendar")?.tasks.next(p.id) ?? null, ...waiting.get(p.id)! };
  });
}

/** Project list, newest first. Filters: stage, person_id, person_ids (comma separated), active (not cancelled, in maintenance or delivered). */
export function projectList(ctx: Ctx, o: ListOpts): { rows: ProjectRow[]; total: number } {
  const f = o.filter ?? {};
  let list = rows<Listed>(ctx, `${PROJECT_SELECT} ORDER BY pr.id DESC`);
  if (f.stage) list = list.filter((p) => p.stage === f.stage);
  if (f.person_id) list = list.filter((p) => p.person_id === Number(f.person_id));
  if (f.person_ids !== undefined) {
    const people = new Set(String(f.person_ids).split(",").map(Number));
    list = list.filter((p) => people.has(p.person_id));
  }
  if (bool(f.active)) list = list.filter((p) => p.stage !== CANCELLED_STAGE && p.stage !== "bakim" && p.stage !== "teslim");
  list = list.filter((p) => has(o.q, p.name, p.person_name));
  const sliced = page(list, o.limit, o.offset);
  return { rows: withNext(ctx, sliced.rows), total: sliced.total };
}

/** One project as listed, without loading the rest */
export function projectGet(ctx: Ctx, id: number): ProjectRow | undefined {
  return withNext(ctx, rows<Listed>(ctx, `${PROJECT_SELECT} WHERE pr.id = ?`, id))[0];
}

export const projectRef = (ctx: Ctx, id: number): ProjectRef | undefined =>
  keptRow<ProjectRef>(ctx, "SELECT id, name, person_id, opportunity_id FROM projects WHERE id = ?", id);

export const namesOf = (ctx: Ctx, ids: number[]): Map<number, string> =>
  new Map(ids.length ? keptRows<{ id: number; name: string }>(ctx, "SELECT id, name FROM projects WHERE id IN (SELECT value FROM json_each(?))", JSON.stringify(ids)).map((r) => [r.id, r.name]) : []);

export const forOpportunity = (ctx: Ctx, opportunityId: number): number | undefined =>
  keptRow<{ id: number }>(ctx, "SELECT id FROM projects WHERE opportunity_id = ?", opportunityId)?.id;

/** Opportunity id to project id for a list of opportunities (one statement, the ids travel as JSON) */
export function idsForOpportunities(ctx: Ctx, opportunityIds: number[]): Map<number, number> {
  return new Map(keptRows<{ id: number; opportunity_id: number }>(ctx,
    "SELECT id, opportunity_id FROM projects WHERE opportunity_id IN (SELECT value FROM json_each(?))", JSON.stringify(opportunityIds)).map((r) => [r.opportunity_id, r.id]));
}

export const countOf = (ctx: Ctx, personId: number): number =>
  keptRow<{ n: number }>(ctx, "SELECT COUNT(*) n FROM projects WHERE person_id = ?", personId)?.n ?? 0;

/** Per person: projects and money received */
export function personStats(ctx: Ctx): Map<number, PersonProjectStats> {
  return new Map(keptRows<PersonProjectStats & { person_id: number }>(ctx, `
    SELECT pr.person_id, COUNT(DISTINCT pr.id) AS projects, COALESCE(SUM(pa.paid_amount), 0) AS collected
    FROM projects pr LEFT JOIN payments pa ON pa.project_id = pr.id GROUP BY pr.person_id`).map(({ person_id, ...stats }): [number, PersonProjectStats] => [person_id, stats]));
}

/** Per company (through the person of each project): projects, money received and money still due on them, in one statement */
export function moneyByCompany(ctx: Ctx): Map<number, CompanyProjectMoney> {
  return new Map(keptRows<CompanyProjectMoney & { company_id: number }>(ctx, `
    SELECT pe.company_id, COUNT(DISTINCT pr.id) AS projects, COALESCE(SUM(pa.paid_amount), 0) AS paid,
      COALESCE(SUM(CASE WHEN ${NOT_CANCELLED} THEN MAX(pa.expected_amount - pa.paid_amount, 0) ELSE 0 END), 0) AS due, MIN(pr.started_at) AS first_started
    FROM projects pr JOIN people pe ON pe.id = pr.person_id LEFT JOIN payments pa ON pa.project_id = pr.id
    WHERE pe.company_id IS NOT NULL GROUP BY pe.company_id`).map(({ company_id, ...money }): [number, CompanyProjectMoney] => [company_id, money]));
}

const PAYMENT_SELECT = `
  SELECT pa.*, pr.name AS project_name, pe.name AS person_name
  FROM payments pa JOIN projects pr ON pr.id = pa.project_id JOIN people pe ON pe.id = pr.person_id`;
const PAYMENT_ORDER = "ORDER BY (pa.due_date IS NULL), pa.due_date, pa.id";

/**
 * Payment list, by due date (undated last). Filters: project_id, status, overdue, unpaid, due_within_days. The status is computed.
 * A filter for unpaid money (every status but odendi, overdue, unpaid, due_within_days) leaves out the payments of cancelled projects.
 */
export function paymentList(ctx: Ctx, o: ListOpts): { rows: PaymentRow[]; total: number } {
  const f = o.filter ?? {};
  const today = ctx.clock.today();
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.project_id) { where.push("pa.project_id = ?"); args.push(Number(f.project_id)); }
  if ((f.status && f.status !== "odendi") || bool(f.overdue) || bool(f.unpaid) || f.due_within_days !== undefined) where.push(NOT_CANCELLED);
  let list = rows<Omit<PaymentRow, "status">>(ctx, `${PAYMENT_SELECT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ${PAYMENT_ORDER}`, ...args).map((p) => ({ ...p, status: paymentStatus(p, today) }));
  if (f.status) list = list.filter((p) => p.status === f.status);
  if (bool(f.overdue)) list = list.filter((p) => p.status === "gecikmis");
  if (bool(f.unpaid)) list = list.filter((p) => p.status !== "odendi");
  if (f.due_within_days !== undefined) {
    const until = addDays(today, Number(f.due_within_days));
    list = list.filter((p) => p.status !== "odendi" && p.due_date && p.due_date <= until);
  }
  list = list.filter((p) => has(o.q, p.project_name, p.person_name, p.milestone));
  return page(list, o.limit, o.offset);
}

export function paymentGet(ctx: Ctx, id: number): PaymentRow | undefined {
  const today = ctx.clock.today();
  return rows<Omit<PaymentRow, "status">>(ctx, `${PAYMENT_SELECT} WHERE pa.id = ?`, id).map((p) => ({ ...p, status: paymentStatus(p, today) }))[0];
}

export const paymentRef = (ctx: Ctx, id: number) =>
  keptRow<{ id: number; project_id: number; milestone: PaymentRow["milestone"] }>(ctx, "SELECT id, project_id, milestone FROM payments WHERE id = ?", id);

/** Payments whose due date falls in the range (paid ones too, they show as done; the unpaid ones of a cancelled project are left out); the calendar feed reads this */
export function paymentsDue(ctx: Ctx, from: string, to: string): DuePayment[] {
  return rows<DuePayment>(ctx, `SELECT p.id, p.project_id, pr.name AS project_name, p.milestone, p.expected_amount, p.paid_amount, p.due_date, p.paid_amount >= p.expected_amount AS done
    FROM payments p JOIN projects pr ON pr.id = p.project_id
    WHERE p.due_date BETWEEN ? AND ? AND (p.paid_amount >= p.expected_amount OR ${NOT_CANCELLED}) ORDER BY p.id`, from, to)
    .map((r) => ({ ...r, done: !!r.done }));
}
