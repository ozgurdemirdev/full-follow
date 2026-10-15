// Every text the server host writes for a person: login refusals, upload refusals (the console lines of startup are in messages.start.ts).
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
      bodyType: "gövde application/json ya da multipart/form-data olmalı",
    },

    auth: {
      required: "giriş gerekli",
      tooManyAttempts: "çok fazla deneme, bir dakika bekle",
      passwordRequired: "şifre gerekli",
      wrongPassword: "şifre yanlış",
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
