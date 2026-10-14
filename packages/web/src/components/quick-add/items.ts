// What the quick add menu offers: groups of record types with their letter, destination, icon and tile tone
import type { SheetKind } from "../../app/ui";
import { BOARD_ICON } from "../boardIcons";
import { FORM_ICON } from "../forms/icons";

export type Tone = "accent" | "info" | "source" | "claude" | "payment" | "comment" | "neutral";

export interface QuickItem {
  kind: SheetKind;
  name: string;
  /** single letter that opens it while the menu is open */
  key: string;
  dest: string;
  icon: string;
  tone: Tone;
}

const item = (kind: SheetKind, name: string, key: string, dest: string, icon: string, tone: Tone): QuickItem => ({ kind, name, key, dest, icon, tone });

export const QUICK_GROUPS: { name: string; items: QuickItem[] }[] = [
  {
    name: "Kişiler ve iletişim",
    items: [
      item("person", "Kişi", "K", "Kişiler", BOARD_ICON.users, "info"),
      item("company", "Firma", "F", "Firmalar", BOARD_ICON.building, "source"),
      item("touch", "Temas", "T", "Kişinin zaman çizelgesi", BOARD_ICON.comment, "info"),
      item("draft", "Taslak", "Y", "Onay için Taslaklar", BOARD_ICON.pen, "claude"),
      // the current menu has it, the board does not
      item("comment", "Yorum", "R", "Kaydın yorumları", BOARD_ICON.comment, "comment"),
    ],
  },
  {
    name: "Satış",
    items: [
      item("opportunity", "Fırsat", "S", "Satış hunisi", BOARD_ICON.funnel, "payment"),
      item("offer", "Teklif", "E", "Fırsata bağlanır", FORM_ICON.offer, "payment"),
      item("project", "Proje", "P", "Müşteri projeleri", BOARD_ICON.folder, "accent"),
    ],
  },
  {
    name: "Plan",
    items: [
      item("task", "Görev", "G", "Takvim ve bugünün planı", FORM_ICON.task, "accent"),
      item("goal", "Hedef", "H", "Günlük hedefler", FORM_ICON.target, "accent"),
    ],
  },
  {
    name: "Pazarlama",
    items: [
      item("post", "Paylaşım", "L", "Paylaşımlar", BOARD_ICON.megaphone, "comment"),
      item("idea", "Fikir", "I", "Gelir fikirleri", BOARD_ICON.bulb, "comment"),
      item("template", "Şablon", "B", "Şablonlar", BOARD_ICON.template, "comment"),
    ],
  },
  {
    name: "Kendi işlerin",
    items: [item("own_project", "Kendi projem", "O", "Kendi projelerim", BOARD_ICON.cube, "neutral")],
  },
];
