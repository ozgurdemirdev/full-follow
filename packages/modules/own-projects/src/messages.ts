// Every text the own projects module writes for a person or for Claude: record name, errors, event summaries, MCP output.
import { defineMessages } from "@fullfollow/core";

export const m = defineMessages({
  tr: {
    label: "Kendi projelerim",
    // record name (trash list, MCP lines, "not found" errors)
    project: "kendi projesi",
    errors: {
      status: (statuses: string) => `proje durumu: ${statuses}`,
      ideasModuleMissing: `fikirden proje için "ideas" modülü kurulu olmalı`,
      ideaNotFound: (id: number) => `fikir #${id} bulunamadı`,
      topLevelOnly: "sadece en üstteki genel fikir projeye dönüşür",
    },
    events: {
      created: (name: string) => `Kendi projesi: ${name}`,
      status: (from: string, to: string, name: string) => `Proje ${from} → ${to}: ${name}`,
      updated: (name: string) => `Kendi projesi düzenlendi: ${name}`,
      deleted: (name: string) => `Kendi projesi silindi: ${name}`,
      fromIdea: (name: string) => `Fikirden proje: ${name}`,
    },
    // effect strings of a write
    effects: {
      status: (status: string) => `proje → ${status}`,
      ideasMoved: (count: number) => `${count} fikir projeye taşındı`,
      sourceTrashed: "kaynak fikir çöp kutusunda",
    },
    mcp: {
      stage: (stage: string) => `aşama: ${stage}`,
      sellable: (sellable: string) => `satılabilir: ${sellable}`,
      openIdeas: (count: number) => `${count} açık fikir`,
      nextIdea: (title: string) => `sıradaki: ${title}`,
      does: (description: string) => `ne yapıyor: ${description}`,
      sale: (note: string) => `satış: ${note}`,
    },
    docs: {
      save: "own_project: {name,description,status,stage:fikir|dogrulama|demo|urun|null,sellable:evet|belki|hayir,sellable_note,sectors,notes}; {from_idea:'fikir adı'} fikri projeye çevirir (alt fikirler taşınır, fikir çöpe). ",
      move: "Kendi projesi: aktif|beklemede|tamamlandi|birakildi.",
    },
  },
});
