import { fmtDayLong } from "../../lib/format";
import { WEEKDAY_SHORT } from "../../lib/labels";
import { KIND, type CalItem, type Kind } from "../../lib/calendar";

/** Dots a cell shows at most */
const MAX_DOTS = 6;

/** Month view: whole weeks of cells with the done ratio, one dot per item and the first item's title */
export function MonthGrid({ dates, month, items, hidden, picked, today, onPick }: {
  dates: string[];
  /** "YYYY-MM" of the month shown, days outside it are dimmed */
  month: string;
  items: Map<string, CalItem[]>;
  hidden: ReadonlySet<Kind>;
  picked: string;
  today: string;
  onPick: (date: string) => void;
}) {
  return (
    <section aria-label="Ay" className="flex flex-col gap-4 rounded-card border border-border-subtle bg-surface-1 p-9 rise">
      <div className="cal-month" aria-hidden="true">
        {WEEKDAY_SHORT.map((w) => <span key={w} className="px-2 text-sm text-text-muted">{w}</span>)}
      </div>
      <div className="cal-month">
        {dates.map((date) => {
          const all = items.get(date) ?? [];
          const list = all.filter((e) => !hidden.has(e.kind));
          const done = all.filter((e) => e.done).length;
          return (
            <button key={date} type="button" className="cal-cell" aria-pressed={date === picked} aria-label={`${fmtDayLong(date)}, ${all.length} iş`}
              data-today={date === today} data-outside={date.slice(0, 7) !== month} onClick={() => onPick(date)}>
              <span className="flex w-full items-center gap-2">
                <span className={`text-base ${date === today ? "text-accent" : ""}`}>{Number(date.slice(8))}</span>
                <span className="flex-grow" />
                <span className="font-mono text-2xs text-text-muted">{all.length ? `${done}/${all.length}` : ""}</span>
              </span>
              <span className="flex flex-wrap gap-1">
                {list.slice(0, MAX_DOTS).map((e) => <span key={e.key} className={`size-bar-thin rounded-pill ${KIND[e.kind].dot}`} />)}
              </span>
              <span className="cal-mlabel w-full truncate whitespace-nowrap text-xs text-text-secondary">{list[0]?.title ?? ""}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
