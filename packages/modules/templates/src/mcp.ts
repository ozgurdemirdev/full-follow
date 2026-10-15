import type { McpDef, McpFormat } from "@fullfollow/core";
import { m } from "./messages";
import { MCP_BODY_LENGTH, MCP_GROUP_NAME_LENGTH, MCP_GROUP_TEMPLATES } from "./service/constants";

type Row = Record<string, any>;

/** One kind/channel group of the template comparison: `ilk mesaj/e-posta: "A" %18 (40) önde · "B" erken (12)` (at most 3 templates) */
const groupText = (g: Row, f: McpFormat) =>
  `${f.label(g.kind)}/${g.channel ? f.label(g.channel) : m.mcp.allChannels}: ${g.templates.slice(0, MCP_GROUP_TEMPLATES).map((t: Row) =>
    `"${f.cut(t.name, MCP_GROUP_NAME_LENGTH)}" ${t.early ? m.mcp.early : `%${Math.round(t.reply_rate * 100)}`} (${t.sent})${t.leader ? m.mcp.leader : ""}`).join(" · ")}`;

/** How templates read in MCP output, the template line of the marketing report, and the fragments that continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["used", "score", "sector_name"],
  entities: {
    template: {
      kind: m.noun,
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.name}`, f.label(r.kind), r.channel ? f.label(r.channel) : m.mcp.allChannels, r.sector_path ?? m.mcp.allSectors,
        !!r.used && m.mcp.uses(r.used), !!r.sent && m.mcp.replies(r.replied, r.sent), `"${f.cut(r.body, MCP_BODY_LENGTH)}"`,
      ),
    },
  },
  marketing: [{ at: 300, render: (mk, f) => (mk.template_groups.length ? [m.mcp.marketing(mk.template_groups.map((g: Row) => groupText(g, f)).join(" | "))] : []) }],
  docs: {
    open: [{ at: 201, text: "|template" }],
    find: [
      { at: 300, text: "|template" },
      { at: 600, text: m.mcp.findDoc },
    ],
    save: [{ at: 200, text: m.mcp.saveDoc }],
    report: [{ at: 201, text: m.mcp.reportDoc }],
  },
};
