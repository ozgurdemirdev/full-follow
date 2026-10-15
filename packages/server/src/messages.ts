// Every text the server host writes for a person: login refusals, upload refusals (the console lines of startup are in messages.start.ts).
import { defineMessages } from "@fullfollow/core";

export const m = defineMessages({
  tr: {
    unexpectedError: "beklenmeyen hata",

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
