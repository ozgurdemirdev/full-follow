import type { McpDef } from "@fullfollow/core";
import { m } from "./messages";

/** How companies read in MCP output; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["instagram", "linkedin", "open_opps", "city", "segment"],
  entities: {
    company: {
      kind: m.noun,
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.name}`, f.label(r.contact_status), r.segment !== "lead" && r.segment, r.city, r.tags?.join(","), r.sector_path, r.source_name && m.mcp.source(r.source_name),
        !!(r.money?.won || r.money?.due || r.money?.open) && m.mcp.money(f.tl(r.money.won), f.tl(r.money.due), f.tl(r.money.open)),
        r.people_count ? m.mcp.people(r.people_count) : "", !!r.open_opps && m.mcp.openOpps(r.open_opps), r.last_touch_at && m.mcp.lastTouch(f.d(r.last_touch_at)), r.website, r.email,
      ),
      details: (r, f) => f.socials(r),
    },
  },
  docs: {
    open: [{ at: 120, text: "company|" }],
    find: [{ at: 120, text: "company|" }],
    get: [{ at: 410, text: "company: people,touches,opportunities,drafts,comments,channels; " }],
    save: [
      { at: 120, text: "company/" },
      { at: 140, text: m.mcp.saveViaPerson },
      { at: 143, text: "company: {name,website,email,phone,instagram,linkedin,city,notes}. " },
    ],
  },
};
