import type { McpDef } from "@fullfollow/core";

/** How people read in MCP output; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  entities: {
    person: {
      kind: "kişi",
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.name}`, r.tags?.join(","), r.sector_path, r.role, r.company_name, r.contact_status && r.contact_status !== "yazilmadi" && f.label(r.contact_status),
        r.source_name && `kaynak ${r.source_name}`,
        r.awaiting ? `CEVAP BEKLİYOR ${r.awaiting.days}g ${f.label(r.awaiting.channel)}${r.awaiting.attempts > 1 ? ` ${r.awaiting.attempts} deneme` : ""}` : r.last_touch_at && `son ${f.label(r.last_channel)} ${r.days_since}g önce`,
        r.cooling && "SOĞUYOR", r.next_follow_up_at && `takip ${f.d(r.next_follow_up_at)}`, r.handle, r.email, r.phone,
      ),
    },
  },
  relations: { referrals: "person", people: "person" },
  today: [{ at: 600, render: (t, f) => f.section("Takip: kişi", "person", t.follow_ups.people) }],
  docs: {
    open: [{ at: 110, text: "person|" }],
    find: [
      { at: 110, text: "person|" },
      {
        at: 410,
        text: "person/company filter: {tag:'sıcak'} {sector:'Sağlık'} {source:'LinkedIn'} {status:'yazilmadi|yazildi|cevap_geldi|gorusuldu|olumsuz|es_gecildi|tanidik|arkadas'} (virgülle çoklu); person {awaiting:true} {cooling:true} {channel:'linkedin'} {company_id:2} {post_id:2}; ",
      },
    ],
    get: [{ at: 210, text: "|referrals" }],
    save: [
      { at: 110, text: "person/" },
      {
        at: 142,
        text: "person: role (CEO, tasarım; sektör değil). person/company: tags/add_tags/remove_tags ['Sıcak','R10'], sectors ['Sağlık > Diş hekimi'], source:'LinkedIn' (nereden buldum), contact_status:'olumsuz|es_gecildi|tanidik|arkadas'. ",
      },
    ],
  },
};
