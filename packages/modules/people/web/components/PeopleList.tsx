import { useMemo } from "react";
import type { Person, Task } from "@kit/api/types";
import { FilterBar, type StatusFilter } from "./FilterBar";
import { PersonRow } from "./PersonRow";
import type { LabelFilter } from "@kit/components/filters";
import { m as kit } from "@kit/messages";
import { m } from "../messages";

const NO_TASKS: Task[] = [];

/** The list card: filter bar, column heads, one row per person, and the legend */
export function PeopleList({ rows, tasks, today, counts, status, onStatus, chan, onChan, labels, onLabels, onOpen }: {
  rows: Person[];
  tasks: Task[];
  today: string;
  counts: Record<StatusFilter, number>;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  chan: string | null;
  onChan: (c: string | null) => void;
  labels: LabelFilter;
  onLabels: (v: LabelFilter) => void;
  onOpen: (id: number, from: HTMLElement) => void;
}) {
  // tasks grouped once: a row gets the (stable) array of its own person, not the whole list to scan
  const byPerson = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const t of tasks) if (t.person_id !== null) map.set(t.person_id, [...(map.get(t.person_id) ?? NO_TASKS), t]);
    return map;
  }, [tasks]);
  return (
    <section aria-label={m.list.all} className="ppl-list">
      <FilterBar status={status} onStatus={onStatus} counts={counts} chan={chan} onChan={onChan} labels={labels} onLabels={onLabels} />
      <div className="ppl-row ppl-rhead" aria-hidden="true">
        <span>{kit.nouns.person}</span><span>{m.list.lastTouch}</span><span className="ppl-rhythm">{m.list.rhythm}</span><span className="ppl-next">{m.list.next}</span>
      </div>
      {rows.map((p) => <PersonRow key={p.id} p={p} tasks={byPerson.get(p.id) ?? NO_TASKS} today={today} onOpen={onOpen} />)}
      {rows.length === 0 ? <p className="m-0 border-t border-border-subtle px-8 py-11 text-base text-text-muted">{m.list.empty}</p> : null}
      <div className="ppl-foot">
        <span>{m.list.showing(rows.length)}</span>
        <span className="flex items-center gap-6">
          <span className="ppl-key" data-warm="hot"><i />{m.list.hot}</span>
          <span className="ppl-key" data-warm="mid"><i />{m.list.mid}</span>
          <span className="ppl-key" data-warm="cold"><i />{m.list.cold}</span>
        </span>
      </div>
    </section>
  );
}
