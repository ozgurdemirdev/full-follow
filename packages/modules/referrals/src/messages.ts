import { defineMessages } from "@fullfollow/core";

/** Texts of the referrals module's server side: module label, MCP words, the task titles and the sentences of the suggestion lists */
export const m = defineMessages({
  tr: {
    label: "Referanslar",
    /** Currency sign written before an amount */
    lira: "₺",
    mcp: { reportDoc: "referans değeri, " },
    /** What Claude is asked for: the task a request creates has this title, and the row is "asked" while that task is open */
    requestTitle: {
      thanks: (name: string) => `${name} için teşekkür mesajı taslağı hazırla`,
      ask: (name: string) => `${name} için referans ricası taslağı hazırla`,
    },
    /** The sentence under a suggestion */
    why: {
      thanks: (name: string, value: string | null) => `Tanıttığı ${name} kazanıldı${value ? ` · ${value}` : ""}`,
      askReady: (project: string, ago: string) => `${project} ${ago} teslim edildi, ödemesi tamam. Kimseyi tanıtmadı.`,
      askLate: (owed: string) => `Şimdi değil: ${owed} ödemesi gecikmede`,
      today: "bugün",
      daysAgo: (days: number) => `${days} gün önce`,
    },
  },
});
