// Display names of the enum values the kit and several modules show (stages, channels, contact statuses, record kinds ...).
// `lib/labels.ts` keeps the exports every screen imports and takes the words from here.
import { defineMessages } from "./lib/i18n";
import { m } from "./messages";

export const labels = defineMessages({
  tr: {
    stage: {
      bulundu: "Bulundu", temas: m.nouns.touch, cevap: "Cevap", gorusme: "Görüşme", teklif: "Teklif", kazanildi: "Kazanıldı", kaybedildi: "Kaybedildi",
    },
    projectStage: {
      pesinat: "Peşinat", tasarim_onayi: "Tasarım onayı", test_surumu: "Test sürümü", yayin: "Yayın", teslim: "Teslim", bakim: "Bakım", iptal: "İptal",
    },
    channel: {
      email: m.channelNames.email, instagram: "Instagram DM", linkedin: m.brands.linkedin, telefon: m.channelNames.phone, yuz_yuze: "Yüz yüze",
      whatsapp: "WhatsApp", r10: "R10 mesajı", diger: m.other,
    },
    contactStatus: {
      yazilmadi: "Yazılmadı", yazildi: "Yazıldı", cevap_geldi: "Cevap geldi", gorusuldu: "Görüşüldü", olumsuz: "Olumsuz", es_gecildi: "Es geçildi", tanidik: "Tanıdık", arkadas: "Arkadaş",
    },
    target: {
      person: m.nouns.person, company: m.nouns.company, opportunity: m.nouns.opportunity, project: m.nouns.project, task: m.nouns.task, draft: m.nouns.draft,
      payment: m.nouns.payment, post: m.nouns.post, idea: m.nouns.idea, own_project: "Kendi projesi",
    },
    actor: { ozgur: m.owner, claude: m.claude },
    platform: { r10: "R10", linkedin: m.brands.linkedin, instagram: m.brands.instagram, diger: m.other },
    templateKind: { ilk: "İlk mesaj", takip: m.follow, teklif: "Teklif sonrası", diger: m.other },
    ideaStage: { fikir: m.nouns.idea, dogrulaniyor: "Doğrulanıyor", demo: "Demo", urun: "Ürün" },
    assignee: { ozgur: m.you, claude: m.claude, musteri: m.customer },
    /** Weekday short names (ISO order, Monday first) */
    weekdayShort: { mon: "Pzt", tue: "Sal", wed: "Çar", thu: "Per", fri: "Cum", sat: "Cmt", sun: "Paz" },
  },
});
