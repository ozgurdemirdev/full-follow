import { qs } from "@kit/api/client";
import { useQuery } from "@kit/api/store";
import type { List, Task } from "@kit/api/types";
import { NextStep } from "../components/NextStep";
import { NEXT_STEP_TASKS } from "../constants";

/**
 * "Sıradaki adım" of a person, an opportunity or a project (slots "opportunity.side" of the opportunity page and "timeline.next-step" of the
 * timeline's record view): the follow-up date and the nearest open task of the record. `className` is the host's layout class: with it the card gets a wrapper.
 */
export function RecordNextStep({ type, id, personId, followUp, className }: {
  type: "person" | "opportunity" | "project";
  id: number;
  personId?: number;
  followUp?: string | null;
  className?: string;
}) {
  const tasks = useQuery<List<Task>>(`/tasks${qs({ [`${type}_id`]: id, limit: NEXT_STEP_TASKS })}`);
  const card = <NextStep tasks={tasks.data?.rows ?? []} type={type} id={id} personId={personId} followUp={followUp} />;
  return className ? <div className={className}>{card}</div> : card;
}
