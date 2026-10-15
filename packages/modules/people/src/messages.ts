import { defineMessages } from "@fullfollow/core";

/** Texts of the people module's server side: module label, errors, event summaries, MCP lines and tool description fragments */
export const m = defineMessages({
  tr: {
    label: "Kişiler",
    /** What one person is called in a sentence, a record label and the MCP output */
    noun: "kişi",
    /** The same word typed without Turkish letters (an alias of the record type) */
    nounAscii: "kisi",
    notFound: (id: number) => `kişi #${id} bulunamadı`,
    events: {
      created: (name: string) => `Kişi eklendi: ${name}`,
      updated: (fields: string) => `Kişi güncellendi (${fields})`,
      status: (name: string, from: string, to: string) => `Temas durumu ilerledi: ${name} (${from} → ${to})`,
      deleted: (name: string) => `Kişi silindi: ${name}`,
    },
    /** Field names the update summary lists, by column or input key */
    fieldNames: {
      name: "ad",
      company_id: "firma",
      role: "rol",
      email: "e-posta",
      phone: "telefon",
      handle: "kullanıcı adı",
      instagram: "Instagram",
      linkedin: "LinkedIn",
      referred_by_id: "referans",
      post_id: "kaynak paylaşım",
      source_id: "nereden",
      contact_status: "durum",
      influence: "karar rolü",
      next_follow_up_at: "takip tarihi",
      notes: "not",
      tags: "etiket",
      sectors: "sektör",
    },
    errors: {
      referrer: "referans kişisi",
      post: "paylaşım",
      referralLoop: "referans döngüsü: kişi kendi alt referansına bağlanamaz",
      hasOpportunities: (name: string) => `${name} silinemez: fırsatları var, önce onları sil`,
      hasProject: (name: string) => `${name} silinemez: projesi var`,
      companyModuleOff: (company: string) => `firma adı verildi ("${company}") ama "companies" modülü kurulu değil; firma adı yerine company_id ver`,
    },
    mcp: {
      role: (influence: string) => `rol ${influence}`,
      source: (name: string) => `kaynak ${name}`,
      awaiting: (days: number, channel: string, attempts: number) => `CEVAP BEKLİYOR ${days}g ${channel}${attempts > 1 ? ` ${attempts} deneme` : ""}`,
      lastTouch: (channel: string, days: number) => `son ${channel} ${days}g önce`,
      cooling: "SOĞUYOR",
      followUp: (date: string) => `takip ${date}`,
      referralValue: (v: { direct: number; network: number; opps: number; won: number; won_value: number; open_value: number; collected: number }, tl: (n: number) => string) =>
        `referans değeri: ${v.direct} tanıttı (ağ ${v.network}) · ${v.opps} fırsat · ${v.won} kazanıldı ${tl(v.won_value)}${v.open_value ? ` · açık ${tl(v.open_value)}` : ""}${v.collected ? ` · tahsil ${tl(v.collected)}` : ""}`,
      sourcePost: (id: number, title: string) => `kaynak paylaşım: #${id} ${title}`,
      followUpSection: "Takip: kişi",
      /** Fragments that continue the generic tools' descriptions */
      findFilters:
        "person/company filter: {tag:'sıcak'} {sector:'Sağlık'} {source:'LinkedIn'} {status:'yazilmadi|yazildi|cevap_geldi|gorusuldu|olumsuz|es_gecildi|tanidik|arkadas'} (virgülle çoklu); person {awaiting:true} {cooling:true} {channel:'linkedin'} {company_id:2} {post_id:2}; ",
      saveFields:
        "person: role (CEO, tasarım; sektör değil), influence:'karar_verici|etkileyici|kullanici' (satın alma kararındaki rolü; null temizler). person/company: tags/add_tags/remove_tags ['Sıcak','R10'], sectors ['Sağlık > Diş hekimi'], source:'LinkedIn' (nereden buldum), contact_status:'olumsuz|es_gecildi|tanidik|arkadas'. ",
    },
  },
});
