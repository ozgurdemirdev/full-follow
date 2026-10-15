import { defineMessages } from "@fullfollow/core";

/** Follow-up texts used when no template fits, by step (the last one serves every later step) */
const FOLLOWUP_BODIES = [
  "Merhaba {ad}, geçen gün yazdığım mesajı görme fırsatın oldu mu? Uygun olduğunda kısaca konuşabilirsek sevinirim.",
  "Merhaba {ad}, tekrar yazıyorum; şu an önceliğin değilse sorun değil, haber vermen yeterli. İleride ihtiyaç olursa buradayım.",
];

export const m = defineMessages({
  tr: {
    label: "Taslaklar",
    noun: "taslak",
    followupNoun: "takip",
    notFound: "draft not found",
    untitled: (id: number) => `Taslak #${id}`,
    followupBody: (step: number) => FOLLOWUP_BODIES[Math.min(step, FOLLOWUP_BODIES.length) - 1],
    linkNouns: { opportunity: "fırsat", project: "proje" },
    job: {
      created: (effects: string) => `  Takip taslağı hazırlandı: ${effects}`,
      failed: "  Takip taslakları hazırlanamadı:",
    },
    error: {
      templateModuleMissing: (id: number) => `şablon verildi (#${id}) ama "templates" modülü kurulu değil`,
      templateNotFound: (id: number) => `şablon #${id} bulunamadı`,
      linkOnlyPerson: "fırsat ya da proje bağlantısı sadece kişiye yazılan taslakta olur",
      bodyRequired: "body: taslak metni ya da şablon gerekli",
      linkModuleMissing: (what: string, id: number, owner: string) => `${what} verildi (#${id}) ama "${owner}" modülü kurulu değil`,
      linkNotFound: (what: string, id: number) => `${what} #${id} bulunamadı`,
      linkNotTheirs: (what: string, id: number) => `${what} #${id} bu kişiye ya da firmasına ait değil`,
      onlyPendingEdit: (status: string) => `Taslak ${status}; sadece bekleyen taslak düzenlenir`,
      wrongStatus: (status: string) => `Taslak "${status}" durumunda; bu işlem yapılamaz`,
      alreadyStatus: (status: string) => `Taslak zaten ${status}`,
      sentCannotDelete: "Gönderilmiş taslak silinemez (temas kaydı ona bağlı)",
      rejectNote: "ret nedeni gerekli",
    },
    who: { approve: "Taslak onayı", reject: "Taslak reddi", send: "Taslak gönderildi işareti" },
    event: {
      created: (channel: string, body: string) => `Taslak hazırlandı (${channel}): ${body}`,
      approved: "Taslak onaylandı",
      rejected: (note: string) => `Taslak reddedildi: ${note}`,
      sent: (channel: string) => `Taslak gönderildi (${channel})`,
      deleted: (body: string) => `Taslak silindi: ${body}`,
    },
    trashDraft: (body: string) => `Taslak: ${body}`,
    effect: {
      touch: (id: number) => `temas #${id} oluştu`,
      followupDraft: (name: string, step: number) => `${name}: ${step}. takip taslağı`,
    },
    followupReason: (step: number, steps: number, days: number, channel: string) => `Otomatik takip ${step}/${steps}: ${days} gündür cevap yok (${channel})`,
    warning: {
      limit: (channel: string, over: boolean, sent: number, limit: number) => `Uyarı: ${channel} günlük limiti ${over ? "aşıldı" : "doldu"} (${sent}/${limit})`,
      warmup: (until: string) => `Uyarı: soğuk e-posta ısınma döneminde kapalı (${until} tarihine kadar)`,
    },
    mcp: {
      quotaNear: " (yakın)",
      quotaOver: " (doldu)",
      quotaExceeded: " (aştı)",
      quota: (items: string) => `Kota: ${items}`,
      warmup: (until: string) => `Soğuk e-posta kapalı (ısınma ${until}'a kadar)`,
      followupStep: (step: number) => `${step}. takip`,
      reject: (note: string) => `ret: ${note}`,
      person: (id: number, name: string) => `kişi #${id} ${name}`,
      company: (id: number, name: string) => `firma #${id} ${name}`,
      stepOf: (step: number, steps: number) => `${step}/${steps}. takip`,
      noReply: (days: number) => `${days}g cevapsız`,
      autoItem: (name: string, step: number, id: number) => `${name} ${step}. takip #${id}`,
      auto: (count: number, items: string) => `Otomatik takip taslağı hazırlandı (${count}): ${items} · kişiye göre düzelt: save("draft",{body},id)`,
      rules: (rules: string) => `Taslak kuralları (Özgür'ün ret notlarından, bunlara uy):\n${rules}`,
      pendingSection: "Onay bekleyen taslak",
      dueSection: "Takip zamanı (taslak yok)",
      dueCount: (n: number) => `Takip zamanı gelen: ${n}`,
      waiting: "onay bekliyor",
      draftDescription: "Özgür'ün onayına taslak mesaj bırak (why: neden şimdi, tek cümle). Muhatap person, company ya da contact. subject: e-posta konusu. body yoksa template (id/ad) muhataba uygulanır ({ad} {firma} {sektor}); uygun şablon: find template {channel,sector}. Onaylama ve gönderme sadece Özgür'de.",
      todayDoc: "takip dizisi (zamanı gelen takip taslakları otomatik hazırlanır), taslaklar, ",
    },
  },
});
