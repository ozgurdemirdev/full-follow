import { z } from "zod";
import type { McpDef } from "@fullfollow/core";

const fmt = (n: number) => `${n.toLocaleString("tr-TR")}`;

/** How projects and payments read in MCP output, the `pay` tool, and the payment lines of the Today view; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  entities: {
    project: {
      kind: "proje",
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.name}`, r.person_name, f.label(r.stage), `${f.tl(r.paid_total)}/${f.tl(r.price)}`,
        r.next_payment && `sıradaki: ${f.label(r.next_payment.milestone)} ${f.tl(r.next_payment.remaining)}${r.next_payment.due_date ? ` ${f.d(r.next_payment.due_date)}` : ""}`,
        r.next_task && `görev: ${f.cut(r.next_task.title, 40)}`,
      ),
    },
    payment: {
      kind: "ödeme",
      line: (r, f) => f.join(
        `#${r.id} ${r.project_name}`, f.label(r.milestone), `${f.tl(r.paid_amount)}/${f.tl(r.expected_amount)}`, r.due_date && `vade ${f.d(r.due_date)}`,
        r.status !== "bekliyor" && f.label(r.status === "odendi" ? "ödendi" : r.status === "kismi" ? "kısmi" : "gecikmiş"),
      ),
    },
  },
  relations: { projects: "project", payments: "payment" },
  today: [{ at: 900, render: (t, f) => f.section("Ödeme (7 gün)", "payment", t.payments) }],
  docs: {
    today: [{ at: 300, text: "ödemeler" }],
    open: [{ at: 135, text: "|project" }],
    find: [
      { at: 135, text: "|project" },
      { at: 205, text: "|payment" },
      { at: 421, text: "{overdue:true} " },
    ],
    get: [
      { at: 201, text: "projects|payments|" },
      { at: 403, text: "project: links; " },
    ],
    save: [{ at: 132, text: "/project" }],
    move: [{ at: 120, text: "Proje: pesinat|tasarim_onayi|test_surumu|yayin|teslim|bakim|iptal. " }],
  },
  tools: [{
    name: "pay",
    description: "Ödeme gir: tutar mevcut ödenene eklenir (kısmi olabilir). date varsayılan bugün.",
    input: { payment_id: z.number(), amount: z.number(), date: z.string().optional() },
    run: (ctx, { payment_id, amount, date }: { payment_id: number; amount: number; date?: string }, f) => {
      const r = ctx.mod("projects")!.payments.pay(payment_id, amount, date);
      const p = r.row;
      return f.ok("ödeme", p.id, [`${fmt(p.paid_amount)}/${fmt(p.expected_amount)}${p.paid_amount >= p.expected_amount ? " ödendi" : " kısmi"}`, ...r.effects.filter((e) => e !== "tamamen ödendi")]);
    },
  }],
};
