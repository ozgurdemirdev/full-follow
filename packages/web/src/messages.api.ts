// Texts of the api layer: toasts of the shared actions and the network error.
import { defineMessages } from "./lib/i18n";

export const api = defineMessages({
  tr: {
    unreachable: "Sunucuya ulaşılamadı",
    failed: "Bir hata oldu",
    goToRecord: "Kayda git",
    restored: "Geri yüklendi",
    deleted: (label: string) => `${label} silindi`,
  },
});
