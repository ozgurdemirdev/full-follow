import type { McpDef } from "@fullfollow/core";

/** How companies read in MCP output; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  entities: {
    company: {
      kind: "firma",
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.name}`, f.label(r.contact_status), r.tags?.join(","), r.sector_path, r.source_name && `kaynak ${r.source_name}`,
        r.people_count ? `${r.people_count} kişi` : "", !!r.open_opps && `${r.open_opps} açık fırsat`, r.last_touch_at && `son temas ${f.d(r.last_touch_at)}`, r.website, r.email,
      ),
    },
  },
  docs: {
    open: [{ at: 120, text: "company|" }],
    find: [{ at: 120, text: "company|" }],
    get: [{ at: 410, text: "company: people,touches,opportunities,drafts,comments,channels; " }],
    save: [
      { at: 120, text: "company/" },
      { at: 140, text: " (person {company:'ABC'} yoksa firmayı açar)" },
      { at: 143, text: "company: {name,website,email,phone,instagram,linkedin,notes}. " },
    ],
  },
};
