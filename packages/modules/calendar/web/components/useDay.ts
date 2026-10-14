import { useQuery } from "@kit/api/store";
import type { Plan } from "@kit/api/types";
import type { CalendarDay } from "../types";
import { itemsOf, type CalItem } from "../calendar";
import { todayIso } from "@kit/lib/format";

/** The feed the page already loaded: its days are reused instead of asking for the same day again */
export interface Feed {
  from: string;
  to: string;
  days: CalendarDay[] | undefined;
}

/**
 * One day: the plan (tasks with the carried ones on today, goals, streak) and the payments and follow-ups due, as calendar items.
 * A day inside the loaded feed takes its payments and follow-ups from it; only a day outside it asks for its own feed.
 */
export function useDay(date: string, feed?: Feed): { plan: Plan | undefined; items: CalItem[] | null } {
  const inFeed = !!feed && date >= feed.from && date <= feed.to;
  const plan = useQuery<Plan>(`/plan?date=${date}`);
  const own = useQuery<CalendarDay[]>(inFeed ? null : `/calendar?from=${date}&to=${date}`);
  const days = inFeed ? feed.days : own.data;
  const due = days?.find((d) => d.date === date);
  return { plan: plan.data, items: plan.data && days ? itemsOf(date, plan.data.tasks, due?.payments ?? [], due?.follow_ups ?? [], todayIso()) : null };
}
