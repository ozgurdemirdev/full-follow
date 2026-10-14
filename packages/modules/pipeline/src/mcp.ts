import type { McpDef } from "@fullfollow/core";

/** How opportunities, offers and the team read in MCP output, and the pipeline's lines of the Today view; the fragments continue the generic tools' descriptions */
export const mcp: McpDef = {
  /** row fields the lines above already show or that are not worth a line: `get` does not repeat them */
  skip: ["estimated_value", "lost_reason", "source_url", "source_date", "offered_at", "accepted_at"],
  entities: {
    opportunity: {
      kind: "fırsat",
      openable: true,
      line: (r, f) => f.join(
        `#${r.id} ${r.title}`, r.person_name, r.company_name, f.label(r.stage), f.tl(r.estimated_value), r.source_name, r.source_date && `ilan ${f.d(r.source_date)}`, r.source_url,
        r.next_follow_up_at && `takip ${f.d(r.next_follow_up_at)}`, r.lost_reason && `neden: ${f.cut(r.lost_reason, 40)}`, r.project_id && `proje #${r.project_id}`,
      ),
    },
    offer: {
      kind: "teklif",
      line: (r, f) => f.join(
        `#${r.id} v${r.version}`, f.d(r.offered_at), f.tl(r.amount), r.accepted_at && "kabul edildi", r.opportunity_title, !!r.items?.length && `${r.items.length} kalem`,
        r.note && f.cut(r.note, 60), r.file_id && `dosya #${r.file_id}`,
      ),
    },
    /** an extra person on an opportunity (the lines of `get(opportunity, with: ["people"])`) */
    opp_person: {
      kind: "ekip üyesi",
      line: (r, f) => f.join(`#${r.id} ${r.person_name}`, f.label(r.role), r.company_name, r.note && f.cut(r.note, 60)),
    },
  },
  // `get(opportunity, id, with: ["people"])` lists the team, not people
  relations: { opportunities: "opportunity", offers: "offer", "people:opportunity": "opp_person" },
  today: [{ at: 700, render: (t, f) => f.section("Takip: fırsat", "opportunity", t.follow_ups.opportunities) }],
  docs: {
    open: [{ at: 130, text: "opportunity" }],
    find: [
      { at: 130, text: "opportunity" },
      { at: 400, text: "|offer" },
      { at: 402, text: "offer: {opportunity_id:3} teklif sürümleri, yeniden eskiye. " },
      { at: 420, text: "{stage:'teklif'} " },
    ],
    get: [
      { at: 200, text: "opportunities|" },
      { at: 301, text: "|offers|files" },
      { at: 401, text: "people (ekip, ana muhatap hariç),offers (teklif sürümleri),files" },
    ],
    save: [
      { at: 131, text: "/opp" },
      {
        at: 144.1,
        text: "opportunity: source_url, source_date (ilan linki/tarihi); ekip: {add_people:[{person:'Deniz',role:'karar_verici|teknik|ortak|diger',note?}],remove_people:['Ahmet']} (id ile birlikte; ekipteki kişinin rolünü de değiştirir; ana muhatap person_id'dir, ekipte yer almaz). ",
      },
      {
        at: 144.3,
        text: "offer: {opportunity:'Pizza Z'|id,amount,offered_at?,items:[{label,amount}]?,note?} yeni sürüm açar (v1, v2...), id ile güncellenir; {accepted:true|false} + id teklifi kabul eder ya da kabulü geri alır (fırsatta tek kabul edilmiş teklif olur, kabul fırsat değerini teklif tutarına çeker; kazanınca proje fiyatı kabul edilen tekliften). ",
      },
    ],
    move: [{ at: 110, text: "Fırsat: bulundu|temas|cevap|gorusme|teklif|kazanildi|kaybedildi (kaybedildi için reason şart). " }],
  },
};
