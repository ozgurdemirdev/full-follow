import { defineMessages } from "@fullfollow/core";

/** Turkish month names, January first (the insight names a past month) */
const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"] as const;

const ALL_CHANNELS = "tüm kanallar";

export const m = defineMessages({
  tr: {
    label: "Raporlar",
    currency: "₺",
    /** Month name of a month number (1 = January) */
    monthName: (month: number) => MONTH_NAMES[month - 1],
    badMonth: "ay YYYY-AA olmalı (örn. 2026-10)",
    badWeek: "hafta YYYY-Www (örn. 2026-W41) ya da bir tarih olmalı",
    /**
     * The wording of the month insight, one sentence per case. {due}, {surplus}, {missing}, {gap}, {month}, {count} and {budget} are filled in;
     * the lost sentence is appended to the "under the floor" sentence of a past month.
     */
    insight: {
      reached: "Bu ay taban kapandı. Gelen fazlayı vergi ve boş ay yedeği için ayırmak iyi olur.",
      covered: "Beklenen {due} ödeme gelirse taban kapanır ve {surplus} artı kalır.",
      near: "Beklenen {due} ödeme gelirse tabana yalnızca {missing} eksik kalır.",
      short: "Beklenen {due} ödeme gelse bile tabana {missing} eksik kalır.",
      nothingDue: "Bu ay beklenen ödeme kalmadı, tabana {gap} kaldı.",
      pastAbove: "{month} tabanın üstünde kapandı.",
      pastBelow: "{month} tabanın altında kaldı.",
      lost: " O ay {count} teklif kaybedilmişti, toplam bütçesi {budget}.",
      lostNoBudget: " O ay {count} teklif kaybedilmişti.",
    },
    suggestion: {
      target: (target: number, partial: boolean, pace: number, sent: number, lowered?: number) =>
        `Haftalık hedef ${target}, ${partial ? `bu tempoyla ${pace}` : `giden ${sent}`}: ${lowered !== undefined ? `hedefi ${lowered} yap ya da ` : ""}her güne ayrı bir giden mesaj hedefi ekle.`,
      targetTask: (target: number, sent: number) => `Haftalık hedefi gözden geçir (${target}, bu hafta ${sent})`,
      template: (kind: string, channel: string | null, loser: string, leader: string, leaderRate: string, loserRate: string) =>
        `${kind} / ${channel ?? ALL_CHANNELS}: "${loser}" şablonunu bırak, "${leader}" önde (${leaderRate} / ${loserRate}).`,
      templateTask: (loser: string, leader: string) => `"${loser}" şablonunu bırak, "${leader}" kullan`,
      source: (weakest: string, weakestRate: string, best: string, bestRate: string) =>
        `"${weakest}" kaynağı zayıf (cevap ${weakestRate}): zamanı "${best}" kaynağına kaydır (${bestRate}).`,
      sourceTask: (weakest: string, best: string) => `Zamanı "${weakest}" yerine "${best}" kaynağına ayır`,
      quota: (channel: string, days: number) => `${channel} günlük limiti bu hafta ${days} gün doldu: limit işini görüyor, aynı kalsın.`,
      quotaTask: (channel: string, limit: number) => `${channel} günlük limitini koru (${limit})`,
      targetSet: "Haftalık giden mesaj hedefi yok: Ayarlar'dan bir hedef koy, haftayı ona göre ölçersin.",
      targetSetTask: "Haftalık giden mesaj hedefi koy",
      targetMet: (target: number, sent: number) => `Haftalık hedef ${target}, giden ${sent}: bu tempoyu koru.`,
      targetMetTask: "Haftalık giden mesaj temposunu koru",
      records: (added: number) => (added ? `Bu hafta ${added} yeni kayıt eklendi: liste yenilemeyi gelecek hafta da sürdür.` : "Bu hafta yeni kayıt eklenmedi: liste yenileme için gelecek hafta bir gün ayır."),
      recordsTask: "Liste yenileme için bir gün ayır",
      data: "Şablon ve kaynak kıyası için örnek az: mesajlarda şablon seç, kayıtlara kaynak gir.",
      dataTask: "Mesajlarda şablon seç, kayıtlara kaynak gir",
    },
    mcp: {
      allChannels: ALL_CHANNELS,
      noSources: "kaynak yok",
      channels: (days: number, items: string) => `Kanal (${days} gün, kişi): ${items}`,
      periodAll: "tümü",
      periodDays: (days: number | string) => `${days}g`,
      sourceFunnel: (period: string, items: string) => `Kaynak (${period}): ${items}`,
      weak: " zayıf",
      early: " erken",
      sourceTotal: (n: number) => `${n} fırsat`,
      sourceOutcome: (won: number, lost: number, open: number) => `${won} kazanıldı/${lost} kayıp/${open} açık`,
      noConversion: "dönüşüm –",
      conversion: (pct: number) => `dönüşüm %${pct}`,
      wonValue: (value: string) => `kazanılan ${value}`,
      weekLine: (sent: number, replies: number, rate: number | null, meetings: number, newPeople: number) =>
        `Bu hafta: ${sent} giden · ${replies} dönüş${rate !== null ? ` (%${Math.round(rate * 100)})` : ""} · ${meetings} görüşme · ${newPeople} yeni kişi\n`,
      referrals: (items: string) => `Referans: ${items}\n`,
      referralItem: (name: string, people: number, won: number, value: string) => `${name} ${people} kişi, ${won} kazanıldı ${value}`,
      month: (month: string, collected: string, floor: string, gap: string, outstanding?: string) =>
        `${month}: tahsilat ${collected} · taban ${floor} · fark ${gap}${outstanding !== undefined ? ` · vadesi bu ayda kalan ${outstanding}` : ""}`,
      reviewHeader: (week: string, start: string, end: string) => `HAFTALIK İNCELEME ${week} (${start} → ${end})`,
      target: (target: number) => `/${target} hedef`,
      counts: (w: { sent: number; replies: number; meetings: number; offers: number; newPeople: number; newCompanies: number }, target: string, lastSent: number, rate: string, lastRate: string, lastNew: number) =>
        `Giden ${w.sent}${target} (geçen ${lastSent}) · dönüş ${w.replies} ${rate} (geçen ${lastRate}) · görüşme ${w.meetings} · teklif ${w.offers} · yeni ${w.newPeople} kişi, ${w.newCompanies} firma (geçen ${lastNew})`,
      leader: (name: string, rate: string) => `"${name}" önde ${rate}`,
      loser: (name: string, rate: string) => `"${name}" geride ${rate}`,
      earlyCount: (n: number) => `${n} erken`,
      template: (templates: string) => `Şablon: ${templates}`,
      best: (source: string, rate: string) => `en iyi ${source} ${rate}`,
      weakest: (source: string, rate: string) => `zayıf ${source} ${rate}`,
      quotaFull: (channel: string, days: number, limit: number) => `${channel} ${days} gün (limit ${limit})`,
      limitFull: (items: string) => `Limit doldu: ${items}`,
      suggestionsHead: "Gelecek hafta için öneriler:",
      reportDocStart: "pazarlama (",
      reportDoc: "kanal dönüşü), kaynak hunisi (bulundu→yazıldı→cevap→görüşme→teklif→kazanıldı, son 90 gün; zayıf/erken işaretli), kaynak dönüşümü, ayın tahsilatı vs fiyat tabanı. month: YYYY-MM. week: YYYY-Www, haftadan bir tarih ya da \"bu\" verilirse rapor yerine o haftanın incelemesi (Cuma özeti): giden/hedef, dönüş oranı, görüşme, teklif, yeni kayıt, şablon ve kaynak öne çıkanları, limit aşımı, gelecek hafta için 2-4 öneri.",
    },
  },
});
