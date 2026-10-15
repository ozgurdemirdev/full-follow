// Texts of the kit's shared parts: filters, the files and links cards, the expand overlay, the mic and number fields,
// the quick add menu, the settings parts, the small ui pieces and the combo box.
import { defineMessages } from "./lib/i18n";
import { m as kit } from "./messages";

export const parts = defineMessages({
  tr: {
    filters: {
      group: "Filtreler",
      status: "Temas durumu",
      allStatuses: "Tüm durumlar",
      tag: "Etiket",
      allTags: "Tüm etiketler",
      sector: kit.nouns.sector,
      allSectors: "Tüm sektörler",
      source: "Nereden buldum",
      allSources: "Tüm kaynaklar",
      count: (n: number) => ` (${n})`,
      pill: "Süzgeç",
      pillCount: (n: number) => `Süzgeç · ${n}`,
      clearAll: "Süzgeci temizle",
    },
    files: {
      added: "Dosya eklendi",
      title: kit.nouns.files,
      empty: "Teklif PDF’i, sunum, sözleşme gibi dosyaları buraya ekle.",
      named: (name: string) => `“${name}” dosyası`,
      pick: "Dosya seç",
      add: "Dosya ekle",
    },
    links: {
      added: "Link eklendi",
      title: kit.nouns.links,
      empty: "Roadmap, teklif sunumu, Figma, repo gibi linkleri buraya ekle.",
      named: (label: string) => `“${label}” linki`,
      labelPlaceholder: "Ad (ör. Roadmap)",
      labelAria: "Link adı",
      urlPlaceholder: "https://…",
      urlAria: "Link adresi",
    },
    mic: { start: "Konuşarak ekle", stop: "Dinlemeyi durdur" },
    stepper: { decrease: "Azalt", increase: "Artır" },
    quick: {
      title: "Yeni kayıt",
      shortcutKey: "N",
      search: "Ne eklemek istiyorsun?",
      searchAria: "Kayıt türü ara",
      none: (q: string) => `“${q}” diye bir kayıt türü yok.`,
      hintPick: "↑ ↓ seç",
      hintOpen: "Enter aç",
      hintLetter: "Harfle doğrudan aç",
      hintClose: "Esc kapat",
    },
    settings: {
      daySuffix: " gün",
      moreRows: (n: number) => `${n} kayıt daha`,
    },
    ui: {
      deletedTag: "Silinmiş etiket",
      expandCard: (title: string) => `${title}, büyüt`,
    },
    combo: { openList: "Listeyi aç", selected: "seçili", fresh: "yeni" },
  },
});
