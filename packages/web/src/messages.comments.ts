// Texts of the comments the kit owns: the comments page, thread cards, the new thread composer, the record's comment box,
// the dashboard's "waiting for you" strip and comments card, and the comment form.
import { defineMessages } from "./lib/i18n";
import { m as kit } from "./messages";

export const comments = defineMessages({
  tr: {
    replied: "Cevap yazıldı",
    claudeInitials: "CL",
    thread: {
      closedFor: (label: string) => `${label} konusu kapandı`,
      reopened: "Konu yeniden açıldı",
      close: "Konu kapandı",
      reopen: "Konuyu yeniden aç",
    },
    bubble: { claude: kit.claude, you: kit.you },
    newThread: {
      opened: "Konu açıldı, Claude MCP’de görüyor",
      title: "Yeni konu",
      writeToClaude: kit.recordActions.writeToClaude,
      about: (label: string) => `${label} hakkında Claude’a yaz`,
      open: "Konu aç",
    },
    box: {
      title: "Yorumlar (Claude ile)",
      newThread: "Yeni konu",
      empty: "Claude’a bu kayıtla ilgili soru ya da not yazabilirsin.",
      closed: "Konu kapandı",
      editLabel: (label: string) => `${label} düzenle`.trim(),
      deleteLabel: (label: string) => `${label} sil`.trim(),
    },
    asks: {
      chip: "Soru",
      waiting: "Senin cevabın bekleniyor",
      toThread: "Konuya git",
      title: "Senden bekleyenler",
      count: (n: number) => `${n} soru`,
    },
    card: {
      waitingOnYou: "Senin cevabın bekleniyor",
      waitingOnClaude: "Claude’un cevabı bekleniyor",
      tagYou: "Senin cevabın",
      tagClaude: "Claude’un cevabı",
      count: (n: number) => `${n} konu`,
      none: "Açık yorum yok.",
      overlaySub: (open: number, mine: number) => `${open} açık konu · ${mine} tanesi senin cevabını bekliyor`,
      overlayFoot: (n: number) => `${n} konuda Claude’un cevabı bekleniyor`,
    },
    form: {
      added: "Yorum eklendi, Claude MCP’den görecek",
      pickTarget: "Neyle ilgili olduğunu seç",
      empty: "Yorum boş olamaz",
      noTarget: "hedef yok",
      about: kit.about,
      aboutPlaceholder: "Fırsat, proje, kişi ya da firma ara",
      body: "Yorum",
      bodyPlaceholder: "Not ya da soru yaz",
      bodyHint: "Özgür olarak yazıyorsun · Claude MCP’den okuyup cevaplar",
    },
    page: {
      sub: "Sen ve Claude, kayıtların üstünde konuşursunuz. Son söz sendeyse Claude cevaplar.",
      tabs: "Konular",
      more: (n: number) => `${n} konu daha`,
    },
  },
});
