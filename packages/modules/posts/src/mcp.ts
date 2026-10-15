import type { McpDef } from "@fullfollow/core";
import { m, platformLabel } from "./messages";
import { MCP_IDEA_LENGTH, MCP_TITLE_LENGTH, MCP_YIELD_POSTS, MCP_YIELD_TITLE_LENGTH } from "./service/constants";

type Row = Record<string, any>;

/** How posts read in MCP output; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["platform", "posted_at", "refresh_days", "refreshed_at", "next_refresh_at"],
  entities: {
    post: {
      kind: m.noun,
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${platformLabel(r.platform)} ${f.cut(r.title, MCP_TITLE_LENGTH)}`, f.d(r.posted_at),
        r.refresh_due ? m.mcp.refreshNow : r.next_refresh_at && m.mcp.refreshOn(f.d(r.next_refresh_at)),
        !!r.people_count && m.mcp.people(r.people_count), !!r.opp_count && m.mcp.opportunities(r.opp_count), !!r.won && m.mcp.won(r.won, f.tl(r.won_value)),
        r.idea_title && m.mcp.idea(f.cut(r.idea_title, MCP_IDEA_LENGTH)), r.url,
      ),
      details: (r, f) => [m.mcp.refreshEvery(r.refresh_every, r.refreshed_at ? f.d(r.refreshed_at) : null), ...(r.format ? [m.mcp.format(r.format)] : [])],
    },
  },
  relations: { posts: "post" },
  today: [{ at: 550, render: (t, f) => f.section(m.mcp.dueSection, "post", t.posts_due ?? { rows: [], total: 0 }) }],
  marketing: [{
    at: 100,
    render: (mk, f) => {
      const out: string[] = [];
      const posts = (mk.posts ?? []).filter((p: Row) => p.people_count || p.opp_count).slice(0, MCP_YIELD_POSTS);
      if (posts.length) out.push(m.mcp.yield(posts.map((p: Row) => m.mcp.yieldItem(f.cut(p.title, MCP_YIELD_TITLE_LENGTH), p.people_count, p.opp_count, p.won ? f.tl(p.won_value) : undefined)).join(" · ")));
      if (mk.posts_due?.length) out.push(m.mcp.dueCount(mk.posts_due.length));
      return out;
    },
  }],
  docs: {
    today: [{ at: 150, text: m.mcp.todayDoc }],
    open: [{ at: 250, text: "|post" }],
    find: [
      { at: 250, text: "|post" },
      { at: 550, text: m.mcp.findDoc },
    ],
    get: [
      { at: 250, text: "|posts" },
      { at: 450, text: ",posts" },
      { at: 550, text: "post: people; " },
    ],
    save: [{
      at: 150,
      text: m.mcp.saveDoc,
    }],
    report: [{ at: 150, text: m.mcp.reportDoc }],
  },
};
