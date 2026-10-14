import type { McpDef } from "@fullfollow/core";

type Row = Record<string, any>;

/** How ideas and interest rows read in MCP output, the idea line of the marketing report, and the fragments that continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["interested", "not_interested", "interest_rate", "post_count", "post_people", "idea_stage", "own_project_title", "priority"],
  entities: {
    idea: {
      kind: "fikir",
      openable: true,
      line: (r, f) => (r.own_project_id
        ? f.join(`#${r.id} ${r.title}`, `proje: ${r.own_project_title}`, f.label(r.priority), r.done_at && "yapıldı", r.problem && `açıklama: ${f.cut(r.problem, 50)}`)
        : f.join(
          `#${r.id} ${r.title}`, f.label(r.stage), r.sectors?.map((x: Row) => x.path).join(", "),
          `${r.told} kişiye anlatıldı, ${r.interested} ilgilendi${r.interest_rate !== null ? ` (%${Math.round(r.interest_rate * 100)})` : ""}`,
          !!r.post_count && `${r.post_count} paylaşım`, r.problem && `sorun: ${f.cut(r.problem, 50)}`,
        )),
      details: (r) => (r.problem ? [`sorun: ${r.problem}`] : []),
    },
    interest: {
      kind: "fikir ilgisi",
      line: (r, f) => f.join(`#${r.id} ${r.person_name}`, r.idea_title, f.label(r.interest), r.note && f.cut(r.note, 50)),
      details: (r) => (r.note ? [`not: ${r.note}`] : []),
    },
  },
  // `get(idea, id, with: ["people"])` lists interest rows, `get(own_project, id, with: ["ideas"])` ideas
  relations: { "people:idea": "interest", ideas: "idea" },
  marketing: [{
    at: 200,
    render: (m, f) => (m.ideas.length ? [`Fikirler: ${m.ideas.slice(0, 5).map((i: Row) => `${f.cut(i.title, 30)} (${f.label(i.stage)}) ${i.interested}/${i.told} ilgi`).join(" · ")}`] : []),
  }],
  docs: {
    open: [{ at: 202, text: "|idea" }],
    find: [
      { at: 301, text: "|idea" },
      { at: 303, text: "|interest" },
      { at: 601, text: "idea {stage,sector,own_project:'Full Follow',general:true}; " },
      { at: 603, text: "interest {idea_id|person_id}; " },
    ],
    get: [{ at: 420, text: "idea: people" }],
    save: [
      { at: 201, text: "idea: {title,problem,stage,sectors:['Sağlık > Diş hekimi'],notes,parent:'üst fikir' (sadece genel), own_project:'Full Follow'|null (null = genel), priority:yuksek|orta|dusuk, position (0 = üst), done:true|false}. " },
      { at: 203, text: "interest: {idea,person,interest:anlatildi|ilgilendi|ilgilenmedi,note}. " },
    ],
    move: [{ at: 130, text: "Fikir: fikir|dogrulaniyor|demo|urun. " }],
    report: [{ at: 200, text: "fikir ilgisi, " }],
  },
};
