import { memo } from "react";
import type { Person, Task } from "../../api/types";
import { agoText, nextStep, STATUS_LABEL, statusOf, warmth, type PStatus } from "../../lib/people";
import { BoardIcon } from "../boardIcons";
import { Avatar } from "../ui";
import { Rhythm } from "./Rhythm";

const NEXT_TONE = { late: "text-danger", today: "text-accent", later: "text-text-muted" } as const;

/** One row of the list: person, last message, 12 week rhythm, next step */
export const PersonRow = memo(function PersonRow({ p, tasks, today, onOpen }: { p: Person; tasks: Task[]; today: string; onOpen: (id: number, from: HTMLElement) => void }) {
  const s: PStatus = statusOf(p, today);
  const next = nextStep(p, tasks, today);
  const msg = p.last_summary ?? "Henüz temas yok";
  const sub = [p.role, p.company_name].filter(Boolean).join(" · ");
  const w = warmth(p.days_since);
  const dir = p.last_direction;
  return (
    <button
      type="button"
      className="ppl-row cv-auto"
      data-record={`person-${p.id}`}
      data-warm={w}
      data-s={s}
      aria-label={`${p.name}, ${msg}`}
      onClick={(e) => onOpen(p.id, e.currentTarget)}
    >
      <span className="flex min-w-0 items-center gap-5">
        <span className="ppl-av">
          <Avatar name={p.name} id={p.id} size="row" />
          <span className="ppl-warm" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base font-medium">{p.name}</span>
          <span className="truncate text-sm text-text-secondary">{sub}</span>
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-4">
        <span className={`ppl-dir ${dir ? "" : "invisible"}`} data-d={dir === "gelen" ? "in" : "out"} title={dir === "gelen" ? "Gelen" : "Giden"}>
          <BoardIcon name={dir === "gelen" ? "dirIn" : "dirOut"} className="size-icon-sm" stroke={2.4} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base-sm text-text-soft">{msg}</span>
          <span className={`text-sm ${w === "cold" ? "text-info" : "text-text-muted"}`}>
            {p.last_touch_at ? agoText(p.days_since) : `eklendi ${agoText(p.days_since)}`}
            {s !== "ok" ? <span className="ppl-tone"> · {STATUS_LABEL[s]}</span> : null}
          </span>
        </span>
      </span>
      <span className="ppl-rhythm" title="Son 12 haftadaki temaslar">
        <Rhythm weeks={p.rhythm} />
      </span>
      <span className="ppl-next min-w-0 items-center gap-4">
        <span className="flex min-w-0 flex-grow flex-col">
          <span className="truncate text-base-sm">{next?.text ?? ""}</span>
          <span className={`text-sm ${next ? NEXT_TONE[next.tone] : ""}`}>{next?.at ?? ""}</span>
        </span>
        <span className="ppl-go"><BoardIcon name="arrowRight" className="size-icon-xs" stroke={2.4} /></span>
      </span>
    </button>
  );
});
