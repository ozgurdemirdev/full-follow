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
      hint: "Tek kullanıcılı kurulum. Şifreyi unuttuysan sunucudaki .env dosyasında FF_PASSWORD satırına bak.",
      headlineTop: "Kimi takip edeceğini",
      headlineBottom: "sen değil, liste hatırlar.",
      lead: "Kişiler, fırsatlar, projeler ve tahsilat tek yerde. Claude aynı kayıtları görür, sen onaylarsın.",
    },
    sidebar: {
      main: "Ana menü",
      expand: "Menüyü genişlet",
      collapse: "Menüyü daralt",
      settings: "Ayarlar",
      userName: kit.owner,
      claudeLast: (when: string) => `Claude: ${when}`,
      claudeLastTitle: "Claude’un MCP ile yaptığı son işlem",
      claudeNever: "Claude henüz bağlanmadı",
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
