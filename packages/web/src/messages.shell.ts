// Texts of the shell: the login page, the sidebar, the search, the error boundary and the kit's own manifest.
import { defineMessages } from "./lib/i18n";
import { m as kit } from "./messages";

export const shell = defineMessages({
  tr: {
    brand: "Full Follow",
    brandMark: "ff",
    errorTitle: "Bir şeyler ters gitti",
    errorReload: "Sayfayı yenile",
    login: {
      title: "Tekrar hoş geldin",
      sub: "Devam etmek için şifreni gir.",
      label: "Şifre",
      wrong: "Şifre yanlış. Tekrar dene.",
      failed: "Giriş yapılamadı",
      go: "Giriş yap",
      busy: "Giriş yapılıyor",
      show: "Şifreyi göster",
      hide: "Şifreyi gizle",
      hint: "Tek kullanıcılı kurulum. Şifreyi unuttuysan bilgisayarda npm run reset-password çalıştır (şifre .env dosyasındaki FF_PASSWORD ise oraya bak).",
      mask: "••••••••",
      headlineTop: "Kimi takip edeceğini",
      headlineBottom: "sen değil, liste hatırlar.",
      lead: "Kişiler, fırsatlar, projeler ve tahsilat tek yerde. Claude aynı kayıtları görür, sen onaylarsın.",
    },
    /** First run setup: shown once, before anything else, while there is no password yet (name and password) or no name (name only) */
    setup: {
      title: "Adın ne?",
      sub: "Panelde ve Claude’la konuşurken bu adı kullanırız.",
      subWithPassword: "Panelde ve Claude’la konuşurken bu adı kullanırız. Şifre, paneli senden başkasına kapatır.",
      label: "Adın",
      placeholder: "Örneğin Özgür",
      nameRequired: "Adını yaz.",
      passwordLabel: "Şifre",
      confirmLabel: "Şifre tekrar",
      passwordRule: (min: number) => `En az ${min} karakter`,
      passwordShort: (min: number) => `Şifre en az ${min} karakter olmalı.`,
      mismatch: "Şifreler aynı değil.",
      failed: "Kaydedilemedi",
      go: "Devam et",
      busy: "Kaydediliyor",
      hint: "Sonra Ayarlar’dan değiştirebilirsin.",
      hintWithPassword: "İkisini de sonra Ayarlar’dan değiştirebilirsin. Şifreyi unutursan bu bilgisayarda npm run reset-password ile sıfırlanır.",
    },
    sidebar: {
      main: "Ana menü",
      expand: "Menüyü genişlet",
      collapse: "Menüyü daralt",
      settings: kit.settings,
      claudeLast: (when: string) => `Claude: ${when}`,
      claudeLastTitle: "Claude’un MCP ile yaptığı son işlem",
      claudeNever: kit.claudeNever,
    },
    search: {
      board: "Kişi, şirket, proje ara",
      topbar: "Kişi, firma, fırsat ara",
      shortcut: "⌘K",
    },
    core: {
      label: "Çekirdek",
      dashboard: "Dashboard",
      commentsDest: "Kaydın yorumları",
      commentAdded: "Yorumlar’a eklenir",
    },
  },
});
