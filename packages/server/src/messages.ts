// Every text the server host writes for a person: login refusals, upload refusals, the forgotten password script (the console lines of startup are in messages.start.ts).
import { defineMessages } from "@fullfollow/core";

export const m = defineMessages({
  tr: {
    unexpectedError: "beklenmeyen hata",

    /** Errors Express raises before a route runs (an oversized or broken body), by status */
    http: {
      payloadTooLarge: "istek çok büyük",
      badRequest: "istek okunamadı",
      failed: "istek işlenemedi",
    },

    /** Refusals of the request guard */
    guard: {
      foreignHost: "bu adrese bu bilgisayardan başka bir ad ile ulaşılamaz (FF_ALLOWED_HOSTS ile eklenir)",
      crossOrigin: "başka bir sayfadan gelen değişiklik isteği reddedildi",
      bodyType: "gövde application/json ya da multipart/form-data olmalı",
    },

    auth: {
      required: "giriş gerekli",
      tooManyAttempts: "çok fazla deneme, bir dakika bekle",
      passwordRequired: "şifre gerekli",
      wrongPassword: "şifre yanlış",
      setupRequired: "önce kurulum: adını ve şifreni belirle",
      alreadySetUp: "şifre zaten belirlenmiş",
      passwordShort: (min: number) => `Şifre en az ${min} karakter olmalı`,
      passwordLong: (max: number) => `Şifre en fazla ${max} karakter olabilir`,
      passwordInEnv: "Şifre .env dosyasındaki FF_PASSWORD satırından geliyor; orada değiştirilir",
      wrongCurrent: "Mevcut şifre yanlış",
      storeBroken: (file: string) => `Şifre dosyası okunamadı (${file}); npm run reset-password ile sıfırla`,
    },

    /** The forgotten password script (npm run reset-password), in the terminal */
    reset: {
      envNote: "Not: .env dosyasında FF_PASSWORD var; o şifre geçerli kalır ve sadece .env dosyasından değiştirilir.",
      none: "Panelden belirlenmiş bir şifre yok, silinecek bir şey yok.",
      confirm: (file: string) => `Panelden belirlenen şifre silinecek (${file}). Kayıtların hiçbiri silinmez. Devam edilsin mi? (e/h) `,
      cancelled: "Vazgeçildi, şifre olduğu gibi duruyor.",
      done: "Şifre silindi. Sunucu açıksa kapat ve npm start ile yeniden aç: ilk açılıştaki gibi ad ve yeni şifre sorulur.",
    },
    /** Record files (uploads) */
    files: {
      required: "dosya gerekli",
      megabytes: (bytes: number) => `${bytes / 1024 / 1024} MB`,
      imageTooBig: (size: string) => `Resim en fazla ${size} olabilir`,
      fileTooBig: (size: string) => `Dosya en fazla ${size} olabilir`,
      notFound: "Dosya bulunamadı",
    },
  },
});
