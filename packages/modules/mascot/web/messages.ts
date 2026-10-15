// User facing text of the mascot: the floating jellyfish and its Settings category
import { defineMessages } from "@kit/lib/i18n";
import { m as kit } from "@kit/messages";

export const m = defineMessages({
  tr: {
    open: "Sohbeti aç",
    title: "Maskot",
    intro: "Panelde gezen denizanası. Tıklayınca sohbeti açar, yazı yazarken ve kaydırırken + düğmesinin üstünde bekler.",
    show: kit.show,
    showHint: "Kapalıysa sohbet eski düğmeyle açılır",
    wander: "Gezinsin",
    wanderHint: "Kapalıysa + düğmesinin üstünde durur, yalnız yolundan çekilmesi gerekince hareket eder",
    model: kit.model,
    color: "Renk",
    customColor: "Özel renk",
    size: "Boyut",
    position: "Konum",
    positionHint: "Maskotu varsayılan yerine geri koyar",
    resetPosition: "Konumu sıfırla",
    resetDone: "Maskot yerine döndü",
    seconds: (n: number) => `${n} sn`,
    // colour presets and body models
    presets: { amber: "Amber", mercan: "Mercan", lila: "Lila", lagun: "Lagün", nane: "Nane" },
    variants: { yuvarlak: "Yuvarlak", klasik: "Klasik", etekli: "Etekli" },
    // search words of the settings rows, separated by "|" (a word may hold a space)
    keywords: {
      show: "maskot|denizanası|gizle",
      wander: "maskot|gezinme",
      model: "maskot|yuvarlak|klasik|etekli",
      color: "maskot|özel renk",
      size: "maskot|boyut|büyüklük",
      position: "maskot|sıfırla",
    },
  },
});
