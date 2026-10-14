// What the quick add menu offers: groups of record types with their letter, destination, icon and tile tone
import type { ModuleKey } from "../../api/modules";
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
  /** the module that owns the record; the row is left out when it is not installed (none: core owns it) */
  module?: ModuleKey;
}

const item = (kind: SheetKind, name: string, key: string, dest: string, icon: string, tone: Tone, module?: ModuleKey): QuickItem => ({ kind, name, key, dest, icon, tone, module });

export const QUICK_GROUPS: { name: string; items: QuickItem[] }[] = [
  {
    name: "Kişiler ve iletişim",
    items: [
      item("person", "Kişi", "K", "Kişiler", BOARD_ICON.users, "info", "people"),
      item("company", "Firma", "F", "Firmalar", BOARD_ICON.building, "source", "companies"),
      item("touch", "Temas", "T", "Kişinin zaman çizelgesi", BOARD_ICON.comment, "info", "network"),
      item("draft", "Taslak", "Y", "Onay için Taslaklar", BOARD_ICON.pen, "claude", "drafts"),
      // the current menu has it, the board does not
      item("comment", "Yorum", "R", "Kaydın yorumları", BOARD_ICON.comment, "comment"),
    ],
  },
  {
    name: "Satış",
    items: [
      item("opportunity", "Fırsat", "S", "Satış hunisi", BOARD_ICON.funnel, "payment", "pipeline"),
      item("offer", "Teklif", "E", "Fırsata bağlanır", FORM_ICON.offer, "payment", "pipeline"),
      item("project", "Proje", "P", "Müşteri projeleri", BOARD_ICON.folder, "accent", "projects"),
    ],
  },
  {
    name: "Plan",
    items: [
      item("task", "Görev", "G", "Takvim ve bugünün planı", FORM_ICON.task, "accent", "calendar"),
      item("goal", "Hedef", "H", "Günlük hedefler", FORM_ICON.target, "accent", "calendar"),
    ],
  },
  {
    name: "Pazarlama",
    items: [
      item("post", "Paylaşım", "L", "Paylaşımlar", BOARD_ICON.megaphone, "comment", "posts"),
      item("idea", "Fikir", "I", "Gelir fikirleri", BOARD_ICON.bulb, "comment", "ideas"),
      item("template", "Şablon", "B", "Şablonlar", BOARD_ICON.template, "comment", "templates"),
    ],
  },
  {
    name: "Kendi işlerin",
    items: [item("own_project", "Kendi projem", "O", "Kendi projelerim", BOARD_ICON.cube, "neutral", "own-projects")],
  },
];
