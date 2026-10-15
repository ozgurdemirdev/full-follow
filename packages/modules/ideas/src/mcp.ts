import type { McpDef } from "@fullfollow/core";
import { m } from "./messages";
import { MCP_MARKETING_IDEAS, MCP_TEXT_LENGTH, MCP_TITLE_LENGTH } from "./service/constants";

type Row = Record<string, any>;

/** How ideas and interest rows read in MCP output, the idea line of the marketing report, and the fragments that continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["interested", "not_interested", "interest_rate", "post_count", "post_people", "idea_stage", "own_project_title", "priority"],
  entities: {
    idea: {
      kind: m.noun,
      openable: true,
      line: (r, f) => (r.own_project_id
        ? f.join(`#${r.id} ${r.title}`, m.mcp.project(r.own_project_title), f.label(r.priority), r.done_at && m.mcp.done, r.problem && m.mcp.description(f.cut(r.problem, MCP_TEXT_LENGTH)))
        : f.join(
          `#${r.id} ${r.title}`, f.label(r.stage), r.sectors?.map((x: Row) => x.path).join(", "),
          m.mcp.told(r.told, r.interested, r.interest_rate),
          !!r.post_count && m.mcp.posts(r.post_count), r.problem && m.mcp.problem(f.cut(r.problem, MCP_TEXT_LENGTH)),
        )),
      details: (r) => [...(r.problem ? [m.mcp.problem(r.problem)] : []), ...(r.money_note ? [m.mcp.money(r.money_note)] : []), m.mcp.verdict(r.verdict)],
    },
    interest: {
      kind: m.interestNoun,
      line: (r, f) => f.join(`#${r.id} ${r.person_name}`, r.idea_title, f.label(r.interest), r.note && f.cut(r.note, MCP_TEXT_LENGTH)),
      details: (r) => (r.note ? [m.mcp.note(r.note)] : []),
    },
  },
  // `get(idea, id, with: ["people"])` lists interest rows, `get(own_project, id, with: ["ideas"])` ideas
  relations: { "people:idea": "interest", ideas: "idea" },
  marketing: [{
    at: 200,
    render: (mk, f) => (mk.ideas.length ? [m.mcp.marketing(mk.ideas.slice(0, MCP_MARKETING_IDEAS).map((i: Row) => m.mcp.marketingItem(f.cut(i.title, MCP_TITLE_LENGTH), f.label(i.stage), i.interested, i.told)).join(" · "))] : []),
  }],
  docs: {
    open: [{ at: 202, text: "|idea" }],
    find: [
      { at: 301, text: "|idea" },
      { at: 303, text: "|interest" },
      { at: 601, text: m.mcp.findDoc },
      { at: 603, text: m.mcp.interestFindDoc },
    ],
    get: [{ at: 420, text: "idea: people" }],
    save: [
      { at: 201, text: m.mcp.saveIdeaDoc },
      { at: 203, text: m.mcp.saveInterestDoc },
    ],
    move: [{ at: 130, text: m.mcp.moveDoc }],
    report: [{ at: 200, text: m.mcp.reportDoc }],
  },
};
