import type { McpDef } from "@fullfollow/core";
import { m } from "./messages";
import { MCP_NOTE_LENGTH, MCP_REASON_LENGTH } from "./service/constants";

/** How opportunities, offers and the team read in MCP output, and the pipeline's lines of the Today view; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["estimated_value", "lost_reason", "source_url", "source_date", "offered_at", "accepted_at"],
  entities: {
    opportunity: {
      kind: m.noun,
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.title}`, r.person_name, r.company_name, f.label(r.stage), f.tl(r.estimated_value), r.source_name, r.source_date && m.mcp.listing(f.d(r.source_date)), r.source_url,
        r.next_follow_up_at && m.mcp.followUp(f.d(r.next_follow_up_at)), r.lost_reason && m.mcp.reason(f.cut(r.lost_reason, MCP_REASON_LENGTH)), r.project_id && m.mcp.project(r.project_id),
      ),
    },
    offer: {
      kind: m.offerNoun,
      line: (r, f) => f.join(
        `#${r.id} v${r.version}`, f.d(r.offered_at), f.tl(r.amount), r.accepted_at && m.mcp.accepted, r.opportunity_title, !!r.items?.length && m.mcp.items(r.items.length),
        r.note && f.cut(r.note, MCP_NOTE_LENGTH), r.file_id && m.mcp.file(r.file_id),
      ),
    },
    /** an extra person on an opportunity (the lines of `get(opportunity, with: ["people"])`) */
    opp_person: {
      kind: m.teamNoun,
      line: (r, f) => f.join(`#${r.id} ${r.person_name}`, f.label(r.role), r.company_name, r.note && f.cut(r.note, MCP_NOTE_LENGTH)),
    },
  },
  // `get(opportunity, id, with: ["people"])` lists the team, not people
  relations: { opportunities: "opportunity", offers: "offer", "people:opportunity": "opp_person" },
  today: [{ at: 700, render: (t, f) => f.section(m.mcp.todaySection, "opportunity", t.follow_ups.opportunities) }],
  docs: {
    open: [{ at: 130, text: "opportunity" }],
    find: [
      { at: 130, text: "opportunity" },
      { at: 400, text: "|offer" },
      { at: 402, text: m.mcp.findOfferDoc },
      { at: 420, text: "{stage:'teklif'} " },
    ],
    get: [
      { at: 200, text: "opportunities|" },
      { at: 301, text: "|offers|files" },
      { at: 401, text: m.mcp.getDoc },
    ],
    save: [
      { at: 131, text: "/opp" },
      {
        at: 144.1,
        text: m.mcp.saveOppDoc,
      },
      {
        at: 144.3,
        text: m.mcp.saveOfferDoc,
      },
    ],
    move: [{ at: 110, text: m.mcp.moveDoc }],
  },
};
