// Texts of the dashboard pieces the kit owns: the expand overlay of a card and the projects card.
import { defineMessages } from "./lib/i18n";
import { m as kit } from "./messages";

export const dash = defineMessages({
  tr: {
    percent: (n: number) => `%${n}`,
    overlay: {
      search: "Bu listede ara",
      toPage: (page: string) => `${page} sayfasına git`,
      none: "Burada eşleşen kayıt yok.",
    },
    projects: {
      tabClient: kit.customer,
      tabOwn: "Kendi",
      tabsLabel: "Proje türü",
      paymentOf: (milestone: string) => `${milestone} ödemesi`,
      noDate: "Tarih yok",
      ownProject: kit.ownProject,
      openIdeas: (n: number) => `${n} açık fikir`,
      next: (what: string) => `Sıradaki: ${what}`,
      rowSub: (client: string, next: string) => `${client} · Sıradaki: ${next}`,
      count: (n: number) => `${n} proje`,
      noClient: "Sürmekte olan müşteri projesi yok.",
      noOwn: "Aktif kendi projen yok.",
      overlaySub: (client: number, own: number) => `${client} müşteri projesi, ${own} kendi projen`,
      pageClient: "Müşteri projeleri",
      pageOwn: kit.ownProjects,
      average: (pct: number) => `Ortalama ilerleme %${pct}`,
    },
  },
});
