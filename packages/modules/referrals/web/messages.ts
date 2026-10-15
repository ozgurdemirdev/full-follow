// Texts of the referrals screen. Words the kit shares (record nouns ...) come from `@kit/messages`.
import { defineMessages } from "@kit/lib/i18n";
import { m as kit } from "@kit/messages";

export const m = defineMessages({
  tr: {
    /** Joins the parts of a sub line ("name · company") */
    sep: kit.sep,
    page: {
      sub: "Kim kimi tanıttı, tanıştırdıklarından ve onların ağından ne iş çıktı",
      empty: "Henüz kimse kimseyi tanıtmadı. Kişi eklerken “Tanıtan” alanını doldurunca burada görünür.",
      treeTitle: (name: string) => `${name} ağı`,
    },
    kpis: {
      summary: kit.recordActions.summary,
      wonTitle: "Referanstan kazanılan",
      wonSub: "tüm ağ",
      openTitle: "Açıkta",
      openSub: "referansla gelen fırsatlar",
      rateTitle: "Kapanma oranı",
      rateSub: (rate: string) => `diğer kaynaklar ${rate}`,
      peopleTitle: "Tanıtılan kişi",
      peopleSub: (count: number) => `${count} kişiden`,
    },
    leaders: {
      title: "Tanıtanlar",
      sub: "ağıyla birlikte değer",
      introduced: (count: number) => `${count} kişi tanıttı`,
      withNetwork: (count: number) => `ağıyla ${count}`,
      won: (count: number) => `${count} kazanıldı`,
      opps: (count: number) => `${count} fırsat`,
      projects: (count: number) => `${count} proje`,
      open: (amount: string) => `açıkta ${amount}`,
      collected: (amount: string) => `tahsil ${amount}`,
      noOpen: "açık iş yok",
    },
    tree: { won: "kazanıldı", open: "açık", none: "iş yok" },
    suggestions: {
      thanksTitle: "Teşekkür zamanı",
      thanksEmpty: "Son günlerde referansla kazanılan iş yok.",
      asksTitle: "Kimden referans istenir",
      asksEmpty: "Şu an referans istenecek kimse yok.",
      thanksButton: "Claude teşekkür yazsın",
      askButton: "Claude rica yazsın",
      asked: kit.recordActions.draftAsked,
      drafted: "Taslak hazır",
    },
    requestOk: {
      thanks: "Claude teşekkür taslağını yazıyor, Taslaklar’a düşecek",
      ask: "Claude referans ricasını yazıyor, Taslaklar’a düşecek",
    },
  },
});
