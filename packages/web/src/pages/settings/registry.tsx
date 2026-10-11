import type { ReactNode } from "react";
import { SectorsCard, SourcesCard, TagsCard, TrashCard } from "../SettingsLists";
import { SessionCard } from "./AccountCards";
import { FloorCard, TemplateCard } from "./BusinessCards";
import { ChatNotesCard, ClaudeCard } from "./ClaudeCards";
import { NetworkCard } from "./NetworkCards";

/** Search starts this long after the last keystroke */
export const SETTINGS_SEARCH_DEBOUNCE = 150;

export interface SettingsCard {
  /** stable: React key */
  id: string;
  /** shown title, also searched */
  title: string;
  /** field labels and synonyms, all searched */
  keywords: string[];
  render: () => ReactNode;
}
export interface SettingsCategory {
  slug: string;
  name: string;
  cards: SettingsCard[];
}

/** The single source of categories, cards, titles and search keywords; a card that is not here does not render */
export const SETTINGS: SettingsCategory[] = [
  {
    slug: "is",
    name: "İş ve fiyat",
    cards: [
      { id: "floor", title: "Fiyat tabanı", keywords: ["bağkur", "muhasebe", "gider", "sabit gider", "vergi", "net gelir", "hedef", "taban", "fiyat", "Diğer sabit giderler (aylık)", "Hedeflenen net gelir (aylık)", "Vergi oranı (%)"], render: () => <FloorCard /> },
      { id: "payment-template", title: "Ödeme şablonu", keywords: ["ödeme", "peşinat", "ara ödeme", "teslim", "vade", "yüzde", "gün", "aşama", "şablon"], render: () => <TemplateCard /> },
    ],
  },
  {
    slug: "network",
    name: "Network ve takip",
    cards: [
      { id: "network", title: "Network", keywords: ["cevap bekleme", "soğuma", "takip dizisi", "takip", "haftalık hedef", "giden mesaj", "linkedin", "Cevap bekleme süresi (gün)", "Soğuma süresi (gün)", "Takip dizisi (gün)", "Haftalık giden mesaj hedefi"], render: () => <NetworkCard /> },
    ],
  },
  {
    slug: "listeler",
    name: "Listeler",
    cards: [
      { id: "tags", title: "Etiketler", keywords: ["etiket", "renk"], render: () => <TagsCard /> },
      { id: "sectors", title: "Sektörler", keywords: ["sektör", "alt sektör"], render: () => <SectorsCard /> },
      { id: "sources", title: "Kaynaklar", keywords: ["kaynak", "nereden buldum"], render: () => <SourcesCard /> },
    ],
  },
  {
    slug: "claude",
    name: "Claude",
    cards: [
      { id: "chat-notes", title: "Sohbet sabit notları", keywords: ["sohbet", "sabit not", "kural", "bağlam"], render: () => <ChatNotesCard /> },
      { id: "claude", title: "Claude bağlantısı", keywords: ["mcp", "bağlantı", "sunucu"], render: () => <ClaudeCard /> },
    ],
  },
  {
    slug: "hesap",
    name: "Hesap ve veri",
    cards: [
      { id: "trash", title: "Çöp kutusu", keywords: ["çöp", "silinen", "geri al", "kalıcı sil"], render: () => <TrashCard /> },
      // renders nothing when the password is off; no special case here
      { id: "session", title: "Oturum", keywords: ["oturum", "çıkış"], render: () => <SessionCard /> },
    ],
  },
];
