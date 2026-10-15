import { defineMessages } from "@fullfollow/core";

export const m = defineMessages({
  tr: {
    label: "Paylaşımlar",
    noun: "paylaşım",
    notFound: "post not found",
    platform: { r10: "R10", linkedin: "LinkedIn", instagram: "Instagram", diger: "Diğer" },
    ideaModuleMissing: (id: number) => `fikir verildi (#${id}) ama "ideas" modülü kurulu değil`,
    ideaNotFound: (id: number) => `fikir #${id} bulunamadı`,
    nextRefresh: (date: string) => `sonraki güncelleme ${date}`,
    event: {
      created: (platform: string, title: string) => `Paylaşım (${platform}): ${title}`,
      changed: (refreshed: boolean, title: string) => `Paylaşım ${refreshed ? "güncellendi (yenilendi)" : "düzenlendi"}: ${title}`,
      deleted: (title: string) => `Paylaşım silindi: ${title}`,
    },
    mcp: {
      refreshNow: "GÜNCELLE",
      refreshOn: (date: string) => `güncelle ${date}`,
      people: (n: number) => `${n} kişi`,
      opportunities: (n: number) => `${n} fırsat`,
      won: (n: number, value: string) => `${n} kazanıldı ${value}`,
      idea: (title: string) => `fikir: ${title}`,
      refreshEvery: (days: number, last: string | null) => `yenileme: ${days} günde bir${last !== null ? ` · son ${last}` : ""}`,
      format: (format: string) => `biçim: ${format}`,
      dueSection: "Güncellenecek paylaşım",
      yield: (items: string) => `Paylaşım getirisi: ${items}`,
      yieldItem: (title: string, people: number, opportunities: number, wonValue?: string) =>
        `${title} ${people} kişi, ${opportunities} fırsat${wonValue !== undefined ? `, ${wonValue}` : ""}`,
      dueCount: (n: number) => `Güncellenecek paylaşım: ${n}`,
      todayDoc: "güncellenecek paylaşımlar, ",
      findDoc: "post {refresh_due:true} {platform:'r10'}; ",
      saveDoc: "post: {platform:r10|linkedin|instagram|diger,title,url,posted_at,format:metin|gorsel|video|karusel,refresh_days (boşsa post_refresh_days ayarı)}; id + {refreshed:true} = güncellendi; kişinin kaynağı: person {post:'başlık'}. ",
      reportDoc: "paylaşım getirisi, ",
    },
  },
});

/** Display name of a platform key (the key itself when unknown) */
export const platformLabel = (platform: string): string => (m.platform as Record<string, string>)[platform] ?? platform;
