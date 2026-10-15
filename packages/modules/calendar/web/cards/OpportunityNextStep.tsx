import { qs } from "@kit/api/client";
import { useQuery } from "@kit/api/store";
import type { List, Task } from "@kit/api/types";
import { NextStep } from "@kit/components/NextStep";

/** "Sıradaki adım" on an opportunity page (slot "opportunity.side"): the follow-up date and the nearest open task of the opportunity; `className` is the page's own layout class */
export function OpportunityNextStep({ id, personId, followUp, className }: { id: number; personId: number; followUp: string | null; className: string }) {
  const tasks = useQuery<List<Task>>(`/tasks${qs({ opportunity_id: id, limit: 50 })}`);
  return (
    <div className={className}>
      <NextStep tasks={tasks.data?.rows ?? []} type="opportunity" id={id} personId={personId} followUp={followUp} />
    </div>
  );
}
