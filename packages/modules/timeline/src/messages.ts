import { defineMessages } from "@fullfollow/core";

export const m = defineMessages({
  tr: {
    label: "Zaman çizelgesi",
    badStart: "start: YYYY-MM-DD olmalı",
    badSince: "since: YYYY-MM-DD ya da ISO zaman olmalı",
    badRecord: "record: tür:id olmalı (person:12)",
    badKind: (kind: string, valid: string) => `type: geçersiz tür "${kind}" (geçerli: ${valid})`,
    badCursor: "geçersiz cursor",
    badTimelineType: "timeline için person, opportunity ya da project",
    mcp: {
      toolDescription: "Kişi/fırsat/proje olay geçmişi (son N, eskiden yeniye).",
      noEvents: "olay yok",
    },
  },
});
