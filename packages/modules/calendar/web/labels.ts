import { ASSIGNEE, WEEKDAY_SHORT, type TaskAssignee } from "@kit/lib/labels";

export const ASSIGNEE_ITEMS = (Object.keys(ASSIGNEE) as TaskAssignee[]).map((value) => ({ value, label: ASSIGNEE[value] }));

/** What a goal can count by itself besides a channel */
export const GOAL_METRIC: Record<string, string> = { new_records: "Yeni kayıt (kişi ve firma)" };

/** Task kinds for the task form */
export const TASK_KIND_ITEMS: { value: "gorusme" | "takip" | "gorev"; label: string }[] = [
  { value: "gorev", label: "Görev" }, { value: "gorusme", label: "Görüşme" }, { value: "takip", label: "Takip" },
];

export const GOAL_PRESETS: { value: string; label: string; days: number[] }[] = [
  { value: "her_gun", label: "Her gün", days: [1, 2, 3, 4, 5, 6, 7] },
  { value: "hafta_ici", label: "Hafta içi", days: [1, 2, 3, 4, 5] },
];

/** "1,2,3,4,5" → "Hafta içi" ya da "Pzt Çar" */
export function daysLabel(days: string): string {
  const preset = GOAL_PRESETS.find((p) => p.days.join(",") === days);
  return preset ? preset.label : days.split(",").map((n) => WEEKDAY_SHORT[Number(n) - 1]).join(" ");
}
