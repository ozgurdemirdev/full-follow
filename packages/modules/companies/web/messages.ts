// Texts of the companies screen. Words the kit shares (Kapat, Sil, record nouns ...) come from `@kit/messages`.
import { defineMessages } from "@kit/lib/i18n";
import { m as kit } from "@kit/messages";

export const m = defineMessages({
  tr: {
    /** Joins the parts of a sub line ("sector · city") */
    sep: kit.sep,
    formAddedTo: "Firmalar’a eklenir",
    segment: { client: kit.customer, lead: "Aday", partner: "Partner" },
    sorts: { value: "Değer", recent: kit.recordActions.lastTouch },
    money: { won: "Kazanılan", due: "Bekleyen", open: "Açık fırsat" },
    /** Field names shared by the facts of the overlay and the form */
    fields: {
      city: "Şehir",
      location: "Konum",
      firstTouch: "İlk temas",
      contactStatus: kit.contactStatus,
      email: kit.channelNames.email,
      phone: kit.channelNames.phone,
      web: "Web",
      instagram: kit.brands.instagram,
      linkedin: kit.brands.linkedin,
    },
    draftTask: (name: string) => `${name} için mesaj taslağı hazırla`,
    draftAsked: "Claude doğru kişiye taslak yazıyor, Taslaklar’a düşecek",
    page: {
      sub: "Kimin içinde kimi tanıyorsun, firma sana ne kazandırdı",
      searchLabel: kit.recordActions.searchCompany,
      searchPlaceholder: "Firma, sektör ya da şehir",
      add: "Firma ekle",
      empty: "Bu süzgeçte firma yok.",
      showMore: (count: number) => `${count} firma daha göster`,
    },
    filters: { type: kit.fields.type, sort: "Sırala", sorting: "Sıralama" },
    kpis: {
      summary: kit.recordActions.summary,
      allCompanies: "tüm firmalardan",
      dueTitle: "Bekleyen tahsilat",
      inCompanies: (count: number) => `${count} firmada`,
      unreachedTitle: "Karar vericiye ulaşılmamış",
      giveRoles: "Kişilere karar rolü ver",
      allReached: "Hepsine ulaşıldı",
      namedAndMore: (named: string, extra: number) => `${named} ve ${extra} firma`,
    },
    tile: {
      noInfo: "Bilgi yok",
      since: (segment: string, since: string) => `${segment} · ${since} beri`,
      potential: (amount: string) => `${amount} potansiyel`,
      open: (name: string) => `${name} firmasını aç`,
      won: "kazanılan",
      waiting: (amount: string) => `${amount} bekliyor`,
      openAmount: (amount: string) => `${amount} açık`,
      people: (count: number) => `${count} kişi`,
      noPeople: "Kişi yok",
    },
    aside: {
      toYou: "Bu firma sana",
      none: "Yok",
      work: "Projeler ve fırsatlar",
      noWork: "Henüz proje ya da açık fırsat yok.",
    },
    overlay: {
      moreActions: kit.recordActions.moreActions,
      addTouch: kit.recordActions.addTouch,
      writeDraft: kit.recordActions.writeDraft,
      writeToClaude: kit.recordActions.writeToClaude,
      editFields: "Düzenle, web ve hesaplar",
      draftPending: kit.recordActions.draftPending,
      addPerson: kit.recordActions.addPerson,
      draftAsked: kit.recordActions.draftAsked,
      askDraft: kit.recordActions.askDraft,
    },
    form: {
      nameRequired: "Firma adı gerekli",
      emailInvalid: kit.recordActions.emailInvalid,
      name: "Firma adı",
      cityPlaceholder: "Örn. İstanbul, Kadıköy",
      webPlaceholder: "firma.com",
      emailPlaceholder: "info@firma.com",
      notePlaceholder: "Firmayla ilgili not",
    },
  },
});
