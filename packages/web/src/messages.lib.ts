// Texts of the kit's helper modules under `lib/`: formatting, the people helpers, typed dates, the comments board model,
// the dashboard groups and dictation errors.
import { defineMessages } from "./lib/i18n";
import { m } from "./messages";

export const format = defineMessages({
  tr: {
    /** The lira sign as `tl` writes it after the number */
    liraAfter: (amount: string) => `${amount} ${m.lira}`,
    /** The lira sign in front, as the boards write it: ₺84.500 */
    liraBefore: (amount: string) => `${m.lira}${amount}`,
    now: "şimdi",
    followToday: "Bugün takip",
    followLate: (days: number) => `${days} gün gecikti`,
    followTomorrow: "Yarın takip",
    followOn: (day: string) => `Takip ${day}`,
  },
});

export const people = defineMessages({
  tr: {
    followDraft: "Takip taslağı",
    greetDraft: "Selam taslağı",
    replyDraft: "Cevap taslağı",
    otherDraft: m.nouns.draft,
    draftTask: (name: string) => `${name} için mesaj taslağı hazırla`,
    draftAsked: "Claude taslağı yazıyor, Taslaklar’a düşecek",
    noTouch: "Temas yok",
    lastToday: "bugün",
    lastYesterday: "dün",
    lastDaysAgo: (days: number) => `${days} gün önce`,
    channels: { linkedin: "LinkedIn", email: "E-posta", telefon: "Telefon", instagram: "Instagram" },
  },
});

export const dates = defineMessages({
  tr: {
    friday: "Cuma",
    nextWeek: "Gelecek hafta",
  },
});

export const comments = defineMessages({
  tr: {
    tabs: {
      open: "Açık",
      you: "Sana soruldu",
      claude: "Claude’da",
      closed: "Kapandı",
    },
    empty: {
      open: "Açık konu yok.",
      you: "Claude senden bir şey beklemiyor.",
      claude: "Claude’da bekleyen konu yok, hepsine cevap verdi.",
      closed: "Kapanan konu yok.",
    },
    state: {
      you: "Sana soruldu",
      answered: "Yeni cevap",
      answeredSeen: "Cevaplandı",
      claude: "Claude’da",
      closed: "Kapandı",
    },
    ownProject: "Kendi projem",
  },
});

export const dashboard = defineMessages({
  tr: {
    groups: { late: "Gecikmiş", soon: "Bu hafta", later: "Sonra" },
  },
});

export const dictation = defineMessages({
  tr: {
    denied: "Mikrofon izni verilmedi",
    insecure: "Mikrofon yalnızca localhost ya da https adreslerinde açılır",
    network: "Tarayıcının ses tanıma servisine ulaşılamadı (internet gerekir)",
    nomic: "Mikrofon bulunamadı",
    browser: "Opera ses tanımayı desteklemiyor, Chrome ya da Edge'de aç",
    failed: "Ses tanıma çalışmadı, tekrar dene",
  },
});
