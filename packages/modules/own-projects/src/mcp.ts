import type { McpDef } from "@fullfollow/core";
import { m } from "./messages";

type Row = Record<string, any>;

/** How own projects read in MCP output and the fragments that continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["sellable", "sellable_note", "open_ideas", "done_ideas"],
  entities: {
    own_project: {
      kind: m.project,
      openable: true,
      line: (r, f) => f.join(`#${r.id} ${r.name}`, f.label(r.status), r.stage && m.mcp.stage(f.label(r.stage)), m.mcp.sellable(f.label(r.sellable)), m.mcp.openIdeas(r.open_ideas), r.next_idea && m.mcp.nextIdea(r.next_idea.title), r.sectors?.map((x: Row) => x.path).join(", ")),
      details: (r) => [...(r.description ? [m.mcp.does(r.description)] : []), ...(r.sellable_note ? [m.mcp.sale(r.sellable_note)] : [])],
    },
  },
  docs: {
    open: [{ at: 203, text: "|own_project" }],
    find: [
      { at: 302, text: "|own_project" },
      { at: 602, text: "own_project {status,sellable,sector}; " },
    ],
    get: [{ at: 600, text: "own_project: ideas,links,comments" }],
    save: [{ at: 202, text: m.docs.save }],
    move: [{ at: 131, text: m.docs.move }],
  },
};
