import type { McpDef } from "@fullfollow/core";
import { PLATFORM_LABEL } from "./service/constants";

type Row = Record<string, any>;

/** How posts read in MCP output; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  entities: {
    post: {
      kind: "paylaşım",
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${PLATFORM_LABEL[r.platform] ?? r.platform} ${f.cut(r.title, 50)}`, f.d(r.posted_at),
        r.refresh_due ? "GÜNCELLE" : r.next_refresh_at && `güncelle ${f.d(r.next_refresh_at)}`,
        !!r.people_count && `${r.people_count} kişi`, !!r.opp_count && `${r.opp_count} fırsat`, !!r.won && `${r.won} kazanıldı ${f.tl(r.won_value)}`,
        r.idea_title && `fikir: ${f.cut(r.idea_title, 30)}`, r.url,
      ),
      details: (r, f) => [`yenileme: ${r.refresh_every} günde bir${r.refreshed_at ? ` · son ${f.d(r.refreshed_at)}` : ""}`, ...(r.format ? [`biçim: ${r.format}`] : [])],
    },
  },
  relations: { posts: "post" },
  today: [{ at: 550, render: (t, f) => f.section("Güncellenecek paylaşım", "post", t.posts_due ?? { rows: [], total: 0 }) }],
  marketing: [{
    at: 100,
    render: (m, f) => {
      const out: string[] = [];
      const posts = (m.posts ?? []).filter((p: Row) => p.people_count || p.opp_count).slice(0, 5);
      if (posts.length) out.push(`Paylaşım getirisi: ${posts.map((p: Row) => `${f.cut(p.title, 30)} ${p.people_count} kişi, ${p.opp_count} fırsat${p.won ? `, ${f.tl(p.won_value)}` : ""}`).join(" · ")}`);
      if (m.posts_due?.length) out.push(`Güncellenecek paylaşım: ${m.posts_due.length}`);
      return out;
    },
  }],
  docs: {
    today: [{ at: 150, text: "güncellenecek paylaşımlar, " }],
    open: [{ at: 250, text: "|post" }],
    find: [
      { at: 250, text: "|post" },
      { at: 550, text: "post {refresh_due:true} {platform:'r10'}; " },
    ],
    get: [
      { at: 250, text: "|posts" },
      { at: 450, text: ",posts" },
      { at: 550, text: "post: people; " },
    ],
    save: [{
      at: 150,
      text: "post: {platform:r10|linkedin|instagram|diger,title,url,posted_at,format:metin|gorsel|video|karusel,refresh_days (boşsa post_refresh_days ayarı)}; id + {refreshed:true} = güncellendi; kişinin kaynağı: person {post:'başlık'}. ",
    }],
    report: [{ at: 150, text: "paylaşım getirisi, " }],
  },
};
