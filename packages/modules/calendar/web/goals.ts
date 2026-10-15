import type { GoalDay } from "@kit/api/types";
import { CHANNEL } from "@kit/lib/labels";

/** What a goal counts by itself: "E-posta otomatik (8)" for a channel, "12 eklendi · 3 mükerrer atlandı" for new records; empty when it is counted by hand */
export function goalAutoNote(g: Pick<GoalDay, "channel" | "metric" | "auto" | "duplicates">): string {
  if (g.metric) return [`${g.auto} eklendi`, g.duplicates ? `${g.duplicates} mükerrer atlandı` : ""].filter(Boolean).join(" · ");
  return g.channel ? `${CHANNEL[g.channel]} otomatik${g.auto ? ` (${g.auto})` : ""}` : "";
}
