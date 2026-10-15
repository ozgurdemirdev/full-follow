import { z } from "zod";
import { resolveRef, type McpDef } from "@fullfollow/core";
import { m } from "./messages";
import { MCP_OUTCOME_LENGTH, MCP_SUMMARY_LENGTH } from "./service/constants";

const idOrName = z.union([z.number(), z.string()]);
type Row = Record<string, any>;
/** Muhatap: kişi, firma ya da sadece adres (biri) */
type Subject = { person?: string | number; company?: string | number; contact?: string };

/** How touches read in MCP output, the `touch` tool, and the network's lines of the Today view; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  entities: {
    touch: {
      kind: m.noun,
      line: (r, f) => f.join(
        `#${r.id} ${f.d(r.happened_at)} ${r.direction} ${f.label(r.channel)}`, r.to_name ?? r.person_name, !r.person_id && r.company_id && m.mcp.company, f.cut(r.summary, MCP_SUMMARY_LENGTH),
        r.outcome && `→ ${f.cut(r.outcome, MCP_OUTCOME_LENGTH)}`, r.expects_reply && m.mcp.waitsReply,
        r.suggested_match && m.mcp.suggestion(r.suggested_match.type === "person" ? m.mcp.person : m.mcp.company, r.suggested_match.id, r.suggested_match.name),
      ),
    },
  },
  relations: { touches: "touch" },
  relationLines: {
    channels: (rows, f) => m.mcp.channels(rows.map((c) => m.mcp.channelItem(f.label(c.channel), c.out_count, c.in_count, f.d(c.last_at), !!c.awaiting)).join(" · ")),
  },
  today: [
    // the week line comes first (before the daily quota of the drafts module)
    {
      at: 0,
      head: true,
      render: (t, f) => {
        const w = t.week;
        const target = t.network?.settings?.weekly_target;
        return w ? m.mcp.week(w.sent, target, w.sent_prev, w.replies, w.meetings, w.by_channel?.length ? w.by_channel.map((c: Row) => `${f.label(c.channel)} ${c.sent}/${c.replies}`).join(", ") : null) : "";
      },
    },
    { at: 200, render: (t, f) => (t.network ? f.section(m.mcp.awaitingSection, "person", t.network.awaiting) : "") },
    { at: 800, render: (t, f) => (t.network ? f.section(m.mcp.coolingSection, "person", t.network.cooling) : "") },
  ],
  docs: {
    today: [
      { at: 110, text: m.mcp.todayAwaitingDoc },
      { at: 200, text: m.mcp.todayCoolingDoc },
      { at: 310, text: m.mcp.todayWeekDoc },
    ],
    find: [
      { at: 210, text: "|touch" },
      { at: 430, text: m.mcp.findDoc },
    ],
    get: [
      { at: 110, text: "touches|" },
      { at: 230, text: "|channels" },
      { at: 310, text: "touches," },
      { at: 430, text: ",touches" },
    ],
    save: [{ at: 145, text: m.mcp.saveDoc }],
    report: [{ at: 100, text: m.mcp.reportDoc }],
  },
  tools: [{
    name: "touch",
    description: m.mcp.touchDescription,
    input: {
      person: idOrName.optional(), company: idOrName.optional(), contact: z.string().optional(), channel: z.string(), direction: z.string(), summary: z.string(),
      opp: idOrName.optional(), project: idOrName.optional(), at: z.string().optional(),
      kind: z.string().optional(), outcome: z.string().optional(), idea: idOrName.optional(),
    },
    run: (ctx, a: Subject & Record<string, any>, f) => {
      const r = ctx.mod("network")!.touches.create({
        person_id: a.person !== undefined ? resolveRef(ctx, "person", a.person) : undefined,
        company_id: a.company !== undefined ? resolveRef(ctx, "company", a.company) : undefined,
        contact: a.contact,
        channel: a.channel, direction: a.direction, summary: a.summary,
        opportunity_id: a.opp !== undefined ? resolveRef(ctx, "opportunity", a.opp) : undefined,
        project_id: a.project !== undefined ? resolveRef(ctx, "project", a.project) : undefined,
        happened_at: a.at, kind: a.kind, outcome: a.outcome,
        idea_id: a.idea !== undefined ? resolveRef(ctx, "idea", a.idea) : undefined,
      });
      return f.ok(m.noun, r.row.id, r.effects);
    },
  }],
};
