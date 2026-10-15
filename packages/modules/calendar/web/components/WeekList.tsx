import { toDate } from "@kit/lib/format";
import { WEEKDAY_SHORT } from "@kit/lib/labels";
import { ANYTIME, KIND, type CalItem, type Kind } from "../calendar";
import { Meter } from "@kit/components/ui";
import { m as kit } from "@kit/messages";
import { m } from "../messages";

const PERCENT = 100;

/** Item chip of a day row: kind bar, time, title (struck through when done) */
function Chip({ e }: { e: CalItem }) {
  return (
    <span className={`cal-ev ${e.done ? "opacity-disabled" : ""}`}>
      <span className={`cal-ev-bar ${KIND[e.kind].dot}`} />
      <span className="flex-none font-mono text-xs text-text-muted">{e.time ?? ANYTIME}</span>
      <span className={`truncate whitespace-nowrap text-base-sm ${e.done ? "line-through" : ""}`}>{e.title}</span>
    </span>
  );
}

/** Week view: one row per day with the done ratio and the item chips; a click picks the day */
export function WeekList({ dates, items, hidden, picked, today, onPick }: {
  dates: string[];
  items: Map<string, CalItem[]>;
  hidden: ReadonlySet<Kind>;
  picked: string;
  today: string;
  onPick: (date: string) => void;
}) {
  return (
    <div className="cal-week rise" role="list" aria-label={m.week.list}>
      {dates.map((date, i) => {
        const all = items.get(date) ?? [];
        const done = all.filter((e) => e.done).length;
        const isToday = date === today;
        const past = date < today;
        const visible = all.filter((e) => !hidden.has(e.kind));
        return (
          <button key={date} type="button" role="listitem" className="cal-wrow" aria-pressed={date === picked} data-today={isToday} onClick={() => onPick(date)}>
            <span className="flex min-w-0 flex-col gap-3">
              <span className="flex items-baseline gap-3">
                <span className={`text-cal-num font-light leading-none tracking-kpi ${past ? "text-text-muted" : ""}`}>{Number(date.slice(8))}</span>
                <span className={`text-base-sm ${isToday ? "text-accent" : "text-text-secondary"}`}>{WEEKDAY_SHORT[i]}</span>
                {isToday ? <span className="flex h-badge items-center rounded-pill bg-accent px-3 text-2xs text-accent-on">{kit.today}</span> : null}
              </span>
              <span className="flex items-center gap-3">
                <Meter value={all.length ? (done / all.length) * PERCENT : 0} size="sm" className="flex-grow" color={past && done < all.length ? "bg-danger" : "bg-accent"} label={m.week.dayCompletion(toDate(date).getDate())} />
                <span className="font-mono text-xs text-text-secondary">{all.length ? `${done}/${all.length}` : "–"}</span>
              </span>
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              {visible.map((e) => <Chip key={e.key} e={e} />)}
              {!all.length ? <span className="text-base-sm text-text-disabled">{m.week.emptyDay}</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
