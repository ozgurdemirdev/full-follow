import type { McpDef } from "@fullfollow/core";
import { m } from "./messages";

/** How people read in MCP output; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["instagram", "linkedin", "referred_by_name", "handle", "post_title", "referral_count", "referral_value", "influence"],
  entities: {
    person: {
      kind: m.noun,
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.name}`, r.tags?.join(","), r.sector_path, r.role, r.influence && m.mcp.role(r.influence), r.company_name, r.contact_status && r.contact_status !== "yazilmadi" && f.label(r.contact_status),
        r.source_name && m.mcp.source(r.source_name),
        r.awaiting ? m.mcp.awaiting(r.awaiting.days, f.label(r.awaiting.channel), r.awaiting.attempts) : r.last_touch_at && m.mcp.lastTouch(f.label(r.last_channel), r.days_since),
        r.cooling && m.mcp.cooling, r.next_follow_up_at && m.mcp.followUp(f.d(r.next_follow_up_at)), r.handle, r.email, r.phone,
      ),
      // what the people a person introduced brought (the referrals module's numbers), and the post the person came from
      details: (r, f) => [
        ...f.socials(r),
        ...(r.referral_value ? [m.mcp.referralValue(r.referral_value, f.tl)] : []),
        ...(r.post_title ? [m.mcp.sourcePost(r.post_id, r.post_title)] : []),
      ],
    },
  },
  relations: { referrals: "person", people: "person" },
  today: [{ at: 600, render: (t, f) => f.section(m.mcp.followUpSection, "person", t.follow_ups.people) }],
  docs: {
    open: [{ at: 110, text: "person|" }],
    find: [
      { at: 110, text: "person|" },
      { at: 410, text: m.mcp.findFilters },
    ],
    get: [{ at: 210, text: "|referrals" }],
    save: [
      { at: 110, text: "person/" },
      { at: 142, text: m.mcp.saveFields },
    ],
  },
};
