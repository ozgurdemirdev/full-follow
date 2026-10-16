import { keptRows, MILESTONES, type Ctx, type OpenProjectTask, type ProjectWaiting } from "@fullfollow/core";
import { CANCELLED_STAGE } from "./constants";
import { paymentStatus } from "./payments";

/** Who a project waits on and the TL that wait holds */
export interface Waiting {
  waiting: ProjectWaiting | null;
  waiting_amount: number;
}

/** Tasks given to Claude (a draft or a plan he was asked for) never put a project on hold for the owner or the client */
const NOBODY_WAITS_ON = "claude";

interface PaymentLine {
  id: number;
  project_id: number;
  milestone: (typeof MILESTONES)[number];
  expected_amount: number;
  paid_amount: number;
  due_date: string | null;
}

const left = (p: PaymentLine) => Math.max(0, p.expected_amount - p.paid_amount);

/**
 * Who each project waits on, for a whole list: a few statements, never one per project. A cancelled project waits on nobody.
 * Late (gecikti): a payment is overdue, or an open task of the owner or the client is. Otherwise the open task due first that is not Claude's decides:
 * The owner's means sende, the client's means musteride, none means nobody. The amount is the overdue money for a late project, else what is left of the
 * first unpaid payment (in milestone order) while somebody waits. The tasks come from the calendar module (without it only overdue payments make a project wait).
 */
export function waitingOf(ctx: Ctx, projectIds: number[]): Map<number, Waiting> {
  const out = new Map<number, Waiting>();
  if (!projectIds.length) return out;
  const today = ctx.clock.today();
  const ids = JSON.stringify(projectIds);
  const pays = new Map<number, PaymentLine[]>();
  for (const p of keptRows<PaymentLine>(ctx, "SELECT id, project_id, milestone, expected_amount, paid_amount, due_date FROM payments WHERE project_id IN (SELECT value FROM json_each(?))", ids)) {
    pays.set(p.project_id, [...(pays.get(p.project_id) ?? []), p]);
  }
  const tasks = ctx.mod("calendar")?.tasks.openOfProjects(projectIds);
  const cancelled = new Set(keptRows<{ id: number }>(ctx, "SELECT id FROM projects WHERE stage = ? AND id IN (SELECT value FROM json_each(?))", CANCELLED_STAGE, ids).map((r) => r.id));
  for (const id of projectIds) {
    if (cancelled.has(id)) { out.set(id, { waiting: null, waiting_amount: 0 }); continue; }
    const own = (pays.get(id) ?? []).sort((a, b) => MILESTONES.indexOf(a.milestone) - MILESTONES.indexOf(b.milestone) || a.id - b.id);
    const overdue = own.filter((p) => paymentStatus(p, today) === "gecikmis");
    const firstUnpaid = own.find((p) => paymentStatus(p, today) !== "odendi");
    const open: OpenProjectTask[] = (tasks?.get(id) ?? []).filter((t) => t.assignee !== NOBODY_WAITS_ON);
    const lateTask = open.some((t) => t.due_date && t.due_date < today);
    const owner = open[0]?.assignee;
    const waiting: ProjectWaiting | null = overdue.length || lateTask ? "gecikti" : owner === "owner" ? "sende" : owner === "musteri" ? "musteride" : null;
    const amount = waiting === "gecikti" ? overdue.reduce((a, p) => a + left(p), 0) : waiting && firstUnpaid ? left(firstUnpaid) : 0;
    out.set(id, { waiting, waiting_amount: amount });
  }
  return out;
}
