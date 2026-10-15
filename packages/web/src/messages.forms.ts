// Texts of the form sheet: its frame, the field kinds, the banners, the pickers and the quick add host.
import { defineMessages } from "./lib/i18n";
import { m as kit } from "./messages";

export const forms = defineMessages({
  tr: {
    banners: {
      fix: (n: number) => `${n} alan düzeltilmeli`,
    },
    sheet: {
      drag: "Kapatmak için aşağı sürükle",
    },
    fields: {
      tokens: "Ekle:",
      decrease: "Azalt",
      increase: "Artır",
      dateBad: "Tarihi anlayamadım",
      datePick: "Takvimden seç",
      timeBad: "Saati anlayamadım",
    },
    rich: {
      remove: (label: string) => `${label} kaldır`,
      add: (label: string) => `${label} ekle`,
      itemPlaceholder: "Kalem",
      itemName: "Kalem adı",
      qtyDecrease: "Adedi azalt",
      qtyIncrease: "Adedi artır",
      unitAria: "Birim tutar",
      removeItem: "Kalemi sil",
      addItem: "+ Kalem ekle",
      total: kit.fields.total,
      pctDecrease: "Yüzdeyi azalt",
      pctIncrease: "Yüzdeyi artır",
      pct: (n: number) => `%${n}`,
      replyRate: (rate: string) => `%${rate} cevap`,
    },
    pickers: {
      tags: kit.nouns.tags,
      tagPlaceholder: "Etiket yaz, Enter",
      sectors: kit.nouns.sectors,
      sectorPlaceholder: "Sektör yaz, Enter",
      source: kit.nouns.source,
      status: "Temas durumu",
      statusHint: "Temas ekleyince kendiliğinden ilerler",
    },
    quickAdd: {
      lastChange: (when: string, who: string) => `Son değişiklik ${when}${who ? ` · ${who}` : ""}`,
      edit: (noun: string) => `${noun} düzenle`,
      create: (noun: string) => `${noun} ekle`,
      saving: "Kaydediliyor",
      saveChanges: "Değişiklikleri kaydet",
    },
    shared: {
      updated: (noun: string) => `${noun} güncellendi`,
      created: (noun: string) => `${noun} eklendi`,
      opportunitySub: (person: string) => `Fırsat · ${person}`,
      project: kit.nouns.project,
      person: kit.nouns.person,
      company: kit.nouns.company,
    },
    helpers: {
      personNotCreated: "kişi açılamadı",
    },
  },
});
