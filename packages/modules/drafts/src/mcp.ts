import { z } from "zod";
import { resolveRef, type McpDef, type McpFormat } from "@fullfollow/core";
import { m } from "./messages";
import { MCP_BODY_LENGTH, MCP_NOTE_LENGTH } from "./service/constants";

type Row = Record<string, any>;

const idOrName = z.union([z.number(), z.string()]);
const QUOTA_NOTE: Record<string, string> = { near: m.mcp.quotaNear, over: m.mcp.quotaOver };

/** One short line: sent/limit per limited channel, plus the email warmup notice while it is active */
function quotaText(q: any, f: McpFormat): string {
  if (!q) return "";
  const w = q.email_warmup;
  return [
    q.channels.length ? m.mcp.quota(q.channels.map((c: Row) => `${f.label(c.channel)} ${c.sent}/${c.limit}${c.sent > c.limit ? m.mcp.quotaExceeded : (QUOTA_NOTE[c.state] ?? "")}`).join(" · ")) : "",
    w?.active ? m.mcp.warmup(f.d(w.until)) : "",
  ].filter(Boolean).join("\n");
}

/** How drafts and due follow-ups read in MCP output, the quota and draft lines of the Today view, the `draft` tool, and the fragments that continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["reject_note", "followup_step"],
  entities: {
    draft: {
      kind: m.noun,
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.to_name ?? r.person_name}`, f.label(r.channel), f.label(r.status), !!r.followup_step && m.mcp.followupStep(r.followup_step), `"${f.cut(r.body, MCP_BODY_LENGTH)}"`,
        r.reject_note && m.mcp.reject(f.cut(r.reject_note, MCP_NOTE_LENGTH)),
      ),
    },
    /** a recipient whose follow-up is due (the lines of the "Takip zamanı" section) */
    followup: {
      kind: m.followupNoun,
      line: (r, f) => f.join(
        r.person_id ? m.mcp.person(r.person_id, r.name) : r.company_id ? m.mcp.company(r.company_id, r.name) : r.name, r.person_id && r.company_name,
        m.mcp.stepOf(r.step, r.steps), m.mcp.noReply(r.days), f.label(r.channel),
      ),
    },
  },
  relations: { drafts: "draft" },
  // follow-up drafts in Claude's name for the ones whose time has come (a second call does not open a second draft for the same step); the Today text below lists them
  todayData: (mod) => ({ auto: mod("drafts")!.followups.generate().created.map((c) => m.mcp.autoItem(c.name, c.step, c.draft_id)) }),
  today: [
    // the daily quota sits at the head of the text, after the week line
    { at: 1, head: true, render: (t, f) => quotaText(t.quota, f) },
    { at: 300, render: (t, f) => (t.auto?.length ? m.mcp.auto(t.auto.length, t.auto.join(", ")) : "") },
    { at: 399, render: (t) => (t.draft_rules?.length ? m.mcp.rules(t.draft_rules.map((r: string) => `- ${r}`).join("\n")) : "") },
    { at: 400, render: (t, f) => f.section(m.mcp.pendingSection, "draft", t.drafts) },
    { at: 500, render: (t, f) => f.section(m.mcp.dueSection, "followup", t.followups ?? { rows: [], total: 0 }) },
  ],
  marketing: [{ at: 500, render: (mk) => (mk.followups.length ? [m.mcp.dueCount(mk.followups.length)] : []) }],
  tools: [{
    name: "draft",
    description: m.mcp.draftDescription,
    input: {
      person: idOrName.optional(), company: idOrName.optional(), contact: z.string().optional(), channel: z.string(), body: z.string().optional(),
      template: idOrName.optional(), subject: z.string().optional(), why: z.string().optional(), opp: idOrName.optional(), project: idOrName.optional(),
    },
    run: (ctx, a, f) => {
      const r = ctx.mod("drafts")!.create({
        person_id: a.person !== undefined ? resolveRef(ctx, "person", a.person) : undefined,
        company_id: a.company !== undefined ? resolveRef(ctx, "company", a.company) : undefined,
        contact: a.contact,
        channel: a.channel, subject: a.subject, body: a.body, reason: a.why,
        template_id: a.template !== undefined ? resolveRef(ctx, "template", a.template) : undefined,
        opportunity_id: a.opp !== undefined ? resolveRef(ctx, "opportunity", a.opp) : undefined,
        project_id: a.project !== undefined ? resolveRef(ctx, "project", a.project) : undefined,
      });
      return f.ok(m.noun, r.row.id, [m.mcp.waiting]);
    },
  }],
  docs: {
    today: [{ at: 120, text: m.mcp.todayDoc }],
    open: [{ at: 200, text: "|draft" }],
    find: [
      { at: 200, text: "|draft" },
      { at: 422, text: "{status:'bekliyor'}(draft) " },
    ],
    get: [
      { at: 202, text: "drafts|" },
      { at: 400.1, text: "drafts," },
    ],
  },
};
