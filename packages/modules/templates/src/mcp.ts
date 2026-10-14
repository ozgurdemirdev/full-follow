import type { McpDef, McpFormat } from "@fullfollow/core";

type Row = Record<string, any>;

/** One kind/channel group of the template comparison: `ilk mesaj/e-posta: "A" %18 (40) önde · "B" erken (12)` (at most 3 templates) */
const groupText = (g: Row, f: McpFormat) =>
  `${f.label(g.kind)}/${g.channel ? f.label(g.channel) : "tüm kanallar"}: ${g.templates.slice(0, 3).map((t: Row) =>
    `"${f.cut(t.name, 25)}" ${t.early ? "erken" : `%${Math.round(t.reply_rate * 100)}`} (${t.sent})${t.leader ? " önde" : ""}`).join(" · ")}`;

/** How templates read in MCP output, the template line of the marketing report, and the fragments that continue the generic tools' descriptions */
export const mcp: McpDef = {
  entities: {
    template: {
      kind: "şablon",
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.name}`, f.label(r.kind), r.channel ? f.label(r.channel) : "tüm kanallar", r.sector_path ?? "tüm sektörler",
        !!r.used && `${r.used} kullanım`, !!r.sent && `${r.replied}/${r.sent} dönüş`, `"${f.cut(r.body, 50)}"`,
      ),
    },
  },
  marketing: [{ at: 300, render: (m, f) => (m.template_groups.length ? [`Şablon: ${m.template_groups.map((g: Row) => groupText(g, f)).join(" | ")}`] : []) }],
  docs: {
    open: [{ at: 201, text: "|template" }],
    find: [
      { at: 300, text: "|template" },
      { at: 600, text: "template {channel,sector,kind:'takip'}; " },
    ],
    save: [{ at: 200, text: "template: {name,kind:ilk|takip|teklif|diger,channel?,sector?,body} yer tutucu {ad} {firma} {sektor}. " }],
    report: [{ at: 201, text: "şablon dönüşü, " }],
  },
};
