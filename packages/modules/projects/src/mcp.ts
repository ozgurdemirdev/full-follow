import { z } from "zod";
import { LOCALE, type McpDef } from "@fullfollow/core";
import { m } from "./messages";
import { MCP_TASK_LENGTH, PAYMENTS_DUE_DAYS } from "./service/constants";

const fmt = (n: number) => `${n.toLocaleString(LOCALE)}`;

/** How projects and payments read in MCP output, the `pay` tool, and the payment lines of the Today view; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["paid_total", "expected_total", "next_payment", "next_task", "expected_amount", "paid_amount", "waiting", "waiting_amount"],
  entities: {
    project: {
      kind: m.noun,
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.name}`, r.person_name, f.label(r.stage), `${f.tl(r.paid_total)}/${f.tl(r.price)}`,
        r.next_payment && m.mcp.next(f.label(r.next_payment.milestone), f.tl(r.next_payment.remaining), r.next_payment.due_date ? f.d(r.next_payment.due_date) : undefined),
        r.next_task && m.mcp.task(f.cut(r.next_task.title, MCP_TASK_LENGTH)), r.waiting && m.mcp.waiting(r.waiting, r.waiting_amount ? f.tl(r.waiting_amount) : undefined),
      ),
    },
    payment: {
      kind: m.paymentNoun,
      line: (r, f) => f.join(
        `#${r.id} ${r.project_name}`, f.label(r.milestone), `${f.tl(r.paid_amount)}/${f.tl(r.expected_amount)}`, r.due_date && m.mcp.due(f.d(r.due_date)),
        r.status !== "bekliyor" && f.label(r.status === "odendi" ? m.mcp.statusPaid : r.status === "kismi" ? m.mcp.statusPartial : m.mcp.statusLate),
      ),
    },
  },
  relations: { projects: "project", payments: "payment" },
  today: [{ at: 900, render: (t, f) => f.section(m.mcp.paymentsSection(PAYMENTS_DUE_DAYS), "payment", t.payments) }],
  docs: {
    today: [{ at: 300, text: m.mcp.todayDoc }],
    open: [{ at: 135, text: "|project" }],
    find: [
      { at: 135, text: "|project" },
      { at: 205, text: "|payment" },
      { at: 421, text: "{overdue:true} " },
    ],
    get: [
      { at: 201, text: "projects|payments|" },
      { at: 403, text: "project: links,files; " },
    ],
    save: [{ at: 132, text: "/project" }],
    move: [{ at: 120, text: m.mcp.moveDoc }],
  },
  tools: [{
    name: "pay",
    description: m.mcp.payDescription,
    input: { payment_id: z.number(), amount: z.number(), date: z.string().optional() },
    run: (ctx, { payment_id, amount, date }: { payment_id: number; amount: number; date?: string }, f) => {
      const r = ctx.mod("projects")!.payments.pay(payment_id, amount, date);
      const p = r.row;
      return f.ok(m.paymentNoun, p.id, [`${fmt(p.paid_amount)}/${fmt(p.expected_amount)}${p.paid_amount >= p.expected_amount ? m.mcp.paid : m.mcp.partial}`, ...r.effects.filter((e) => e !== m.effect.fullyPaid)]);
    },
  }],
};
