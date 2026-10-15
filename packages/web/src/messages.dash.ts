// Texts of the dashboard pieces the kit owns: the expand overlay of a card and the projects card.
import { defineMessages } from "./lib/i18n";

export const dash = defineMessages({
  tr: {
    percent: (n: number) => `%${n}`,
    overlay: {
      search: "Bu listede ara",
      toPage: (page: string) => `${page} sayfasına git`,
      none: "Burada eşleşen kayıt yok.",
    },
    projects: {
      tabClient: "Müşteri",
      tabOwn: "Kendi",
      tabsLabel: "Proje türü",
      paymentOf: (milestone: string) => `${milestone} ödemesi`,
      noDate: "Tarih yok",
      ownProject: "Kendi projem",
      openIdeas: (n: number) => `${n} açık fikir`,
      next: (what: string) => `Sıradaki: ${what}`,
      rowSub: (client: string, next: string) => `${client} · Sıradaki: ${next}`,
      count: (n: number) => `${n} proje`,
      noClient: "Sürmekte olan müşteri projesi yok.",
      noOwn: "Aktif kendi projen yok.",
      overlaySub: (client: number, own: number) => `${client} müşteri projesi, ${own} kendi projen`,
      pageClient: "Müşteri projeleri",
      pageOwn: "Kendi projelerim",
      average: (pct: number) => `Ortalama ilerleme %${pct}`,
    },
  },
});
