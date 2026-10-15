// Every text the own projects screens show. Words the whole kit shares (Aç, Sil, Düzenle, record nouns ...) come from `@kit/messages`.
import { defineMessages } from "@kit/lib/i18n";
import { m as kit } from "@kit/messages";
import { parts } from "@kit/messages.parts";

export const m = defineMessages({
  tr: {
    label: kit.ownProjects,
    // value labels
    status: { aktif: "Aktif", beklemede: "Beklemede", tamamlandi: kit.done, birakildi: "Bırakıldı" },
    sellable: { evet: "Satılabilir", belki: "Belki satılır", hayir: "Satılmaz" },
    stages: { fikir: "Fikir", dogrulama: "Doğrulama", demo: "Demo", urun: "Ürün" },
    stage: (label: string) => `Aşama: ${label}`,
    noStage: "Aşama seçilmedi",
    statusOk: (label: string) => `Durum: ${label}`,
    rateNote: (told: number, interested: number) => `${told} kişiye anlattın, ${interested} ilgilendi`,
    notTold: "Henüz kimseye anlatılmadı",
    updatedToday: "bugün güncellendi",
    yesterday: kit.ago.yesterday,
    openProject: (name: string) => `${name} projesini aç`,
    interest: "İlgi",
    // the page
    sub: (live: number, openIdeas: number) => `${live} proje üzerinde çalışıyorsun · ${openIdeas} açık fikir`,
    addProject: "Proje ekle",
    empty: "Henüz kendi projen yok. Kendi ürününü ekle; satılabilir mi, hangi sektöre uyar, sıradaki fikirler neler, burada dursun.",
    revived: (name: string) => `Raftan indirildi: ${name}`,
    // focus project
    focusSection: "Odaktaki proje",
    focus: "Odak",
    nextStep: kit.nextStep,
    nextCheck: (title: string, checked: boolean) => `${title}, ${checked ? "tamamlandı" : "tamamla"}`,
    ideaCounts: (done: number) => `açık · ${done} yapıldı`,
    topIdeas: (titles: string) => `Öncelikli: ${titles}`,
    openFull: "Projeyi aç",
    // gallery
    gallery: { title: "Üzerinde çalıştıkların", hint: "Odağı değiştirmek için projeyi aç", next: "Sırada", interestShort: (rate: string, told: number) => `İlgi ${rate} · ${told} kişi`, notTold: "Henüz anlatılmadı" },
    // shelf
    shelf: { title: "Rafta", hint: "Bırakılan ve tamamlanan projeler", revive: "Raftan indir" },
    // project dialog
    overlay: {
      fallbackTitle: kit.nouns.project,
      moreActions: kit.recordActions.moreActions,
      deleteNoun: (name: string) => `“${name}” projesi`,
      focused: "Odakta",
      takeFocus: "Odağa al",
      earns: "Para kazandırır mı?",
      noSector: "Uygun sektör seçilmedi",
      validation: "Doğrulama",
      rateLabel: "İlgi oranı",
    },
    links: {
      deleteLink: (label: string) => `${label} linkini sil`,
      namePlaceholder: parts.links.labelPlaceholder,
      nameLabel: parts.links.labelAria,
      urlPlaceholder: parts.links.urlPlaceholder,
      urlLabel: parts.links.urlAria,
      add: "Link ekle",
    },
    // form
    form: {
      nameRequired: "Proje adı gerekli",
      name: "Proje adı",
      namePlaceholder: "Örn. Full Follow",
      oneLine: "Tek satırda",
      oneLinePlaceholder: "Ne işe yarar",
      sellable: "Satılabilirlik",
      sellableNote: "Kime, nasıl satılabilir",
      sellableNotePlaceholder: "Örn. Freelancer ve küçük ajanslara kişisel CRM",
      sectors: "Uygun sektörler",
    },
    // manifest and slot
    quickAdd: { name: kit.ownProject, dest: kit.ownProjects, formDest: "Kendi projelerim’e eklenir" },
    ideaToProject: { action: "Projeye dönüştür", opened: "Proje açıldı, Kendi projelerim’de" },
  },
});
