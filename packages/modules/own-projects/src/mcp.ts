import type { McpDef } from "@fullfollow/core";

type Row = Record<string, any>;

/** How own projects read in MCP output and the fragments that continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["sellable", "sellable_note", "open_ideas", "done_ideas"],
  entities: {
    own_project: {
      kind: "kendi projesi",
      openable: true,
      line: (r, f) => f.join(`#${r.id} ${r.name}`, f.label(r.status), r.stage && `aşama: ${f.label(r.stage)}`, `satılabilir: ${f.label(r.sellable)}`, `${r.open_ideas} açık fikir`, r.next_idea && `sıradaki: ${r.next_idea.title}`, r.sectors?.map((x: Row) => x.path).join(", ")),
      details: (r) => [...(r.description ? [`ne yapıyor: ${r.description}`] : []), ...(r.sellable_note ? [`satış: ${r.sellable_note}`] : [])],
    },
  },
  docs: {
    open: [{ at: 203, text: "|own_project" }],
    find: [
      { at: 302, text: "|own_project" },
      { at: 602, text: "own_project {status,sellable,sector}; " },
    ],
    get: [{ at: 600, text: "own_project: ideas,links,comments" }],
    save: [{ at: 202, text: "own_project: {name,description,status,stage:fikir|dogrulama|demo|urun|null,sellable:evet|belki|hayir,sellable_note,sectors,notes}; {from_idea:'fikir adı'} fikri projeye çevirir (alt fikirler taşınır, fikir çöpe). " }],
    move: [{ at: 131, text: "Kendi projesi: aktif|beklemede|tamamlandi|birakildi." }],
  },
};
