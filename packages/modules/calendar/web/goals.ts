import type { GoalDay } from "@kit/api/types";
import { CHANNEL } from "@kit/lib/labels";
import { m } from "./messages";

/** What a goal counts by itself: "E-posta otomatik (8)" for a channel, "12 eklendi · 3 mükerrer atlandı" for new records; empty when it is counted by hand */
export function goalAutoNote(g: Pick<GoalDay, "channel" | "metric" | "auto" | "duplicates">): string {
  if (g.metric) return [m.autoAdded(g.auto), g.duplicates ? m.autoDuplicates(g.duplicates) : ""].filter(Boolean).join(" · ");
  return g.channel ? m.channelAuto(CHANNEL[g.channel], g.auto) : "";
}
