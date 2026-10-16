// The console lines of `npm start`. main.ts must be able to say "the modules did not load" when core itself cannot be
// loaded (a broken SQLite build), so this file imports only the pure i18n file of core, never its index.
import { defineMessages } from "@fullfollow/core/dist/i18n";

export const m = defineMessages({
  tr: {
    failure: (msg: string) => `\n✗ ${msg}`,
    hint: (hint: string) => `  Ne yapmalı: ${hint}`,
    modulesNotLoaded: "Sunucu modülleri yüklenemedi",
    modulesNotLoadedHint: "npm install çalıştır, sonra npm start (Node sürümünü değiştirdiysen önce node_modules klasörünü sil)",
    dbOpenFailed: (file: string) => `Veritabanı ya da uygulama açılamadı (${file})`,
    dbOpenFailedHint: "dosya başka bir programda kilitli olabilir; Full Follow'un başka bir penceresi açıksa kapat",
    alreadyOpen: (url: string) => `\nFull Follow zaten açık: ${url}`,
    portBusy: (port: number) => `${port} portu başka bir program tarafından kullanılıyor`,
    portBusyHint: (port: number) => `.env dosyasına FF_PORT=${port} yaz ve tekrar npm start`,
    listenFailed: "Sunucu dinlemeye başlayamadı",
    ready: (url: string) => `\n  Full Follow hazır: ${url}\n`,
    phone: (address: string, port: number) => `  Telefondan (aynı ağ): http://${address}:${port}`,
    openWithoutPassword: (host: string) => `FF_HOST=${host} şifresiz açılamaz: ağdaki herkes panele girebilirdi`,
    openWithoutPasswordHint: ".env dosyasına FF_PASSWORD yaz ya da FF_HOST satırını sil (şifresiz Full Follow sadece bu bilgisayardan açılır)",
    weakPassword: (min: number) => `
  Uyarı: FF_PASSWORD ${min} karakterden kısa ve panel ağa açık. Ağdaki biri şifreyi deneyerek bulabilir; .env dosyasında en az ${min} karakterlik bir şifre ver.`,
    noPassword: "  Şifre (FF_PASSWORD) tanımlı değil: sadece bu bilgisayardan açılır.",
    webNotBuilt: "  Web arayüzü derlenmemiş; npm start ile derle (API: /api/health)",
    stopHint: "  Kapatmak için Ctrl+C.\n",
    backupDone: (file: string) => `  Yedek alındı: ${file}`,
    backupFailed: "  Yedek alınamadı:",
    unexpected: "Beklenmeyen hata",
    startFailed: "Sunucu başlatılamadı",
  },
});
