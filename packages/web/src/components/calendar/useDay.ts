import { useQuery } from "../../api/store";
import type { CalendarDay, Plan } from "../../api/types";
import { itemsOf, type CalItem } from "../../lib/calendar";
import { todayIso } from "../../lib/format";

/** One day: the plan (tasks with the carried ones on today, goals, streak) and the payments and follow-ups due, as calendar items */
export function useDay(date: string): { plan: Plan | undefined; items: CalItem[] | null } {
  const plan = useQuery<Plan>(`/plan?date=${date}`);
  const feed = useQuery<CalendarDay[]>(`/calendar?from=${date}&to=${date}`);
  const due = feed.data?.[0];
  return { plan: plan.data, items: plan.data && feed.data ? itemsOf(date, plan.data.tasks, due?.payments ?? [], due?.follow_ups ?? [], todayIso()) : null };
}
