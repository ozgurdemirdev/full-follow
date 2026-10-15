import { defineMessages } from "@fullfollow/core";

export const m = defineMessages({
  tr: {
    label: "Şablonlar",
    noun: "şablon",
    sector: "sektör",
    needSubject: "kişi ya da firma gerekli",
    notFound: "template not found",
    event: {
      created: (name: string) => `Şablon eklendi: ${name}`,
      updated: (name: string) => `Şablon düzenlendi: ${name}`,
      deleted: (name: string) => `Şablon silindi: ${name}`,
    },
    tip: {
      unmeasured: "Henüz ölçüm yok. Bir taslakta kullanıp gönderince cevap oranı burada görünür.",
      early: "Gönderimi az olduğu için oranı henüz güvenilir değil.",
      retire: (sent: number, replied: number) => `Bu şablon ${sent} kez gitti, ${replied} cevap aldı.`,
      retireBest: (name: string, rate: string) => ` Aynı tür ve kanalda “${name}” ${rate} cevap alıyor. Bunu arşive kaldırmanı öneririm.`,
      retireAlone: " Bunu arşive kaldırmanı öneririm.",
      leader: (rate: string) => `Aynı tür ve kanalda en yüksek cevap oranı bu şablonda (${rate}).`,
    },
    mcp: {
      allChannels: "tüm kanallar",
      allSectors: "tüm sektörler",
      early: "erken",
      leader: " önde",
      uses: (n: number) => `${n} kullanım`,
      replies: (replied: number, sent: number) => `${replied}/${sent} dönüş`,
      marketing: (groups: string) => `Şablon: ${groups}`,
      saveDoc: "template: {name,kind:ilk|takip|teklif|diger,channel?,sector?,body} yer tutucu {ad} {firma} {sektor}. ",
      findDoc: "template {channel,sector,kind:'takip'}; ",
      reportDoc: "şablon dönüşü, ",
    },
  },
});
