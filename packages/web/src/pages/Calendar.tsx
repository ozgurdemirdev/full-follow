import { useState } from "react";
import { useQuery } from "../api/store";
import type { CalendarDay, Plan } from "../api/types";
import { Page } from "../app/Page";
import { DayPlan } from "../components/DayPlan";
import { Icon } from "../components/icons";
import { CardHead, ErrorBox, PageSkeleton } from "../components/ui";
import { addDaysIso, fmtDayLong, fmtMonth, pct, todayIso, toDate } from "../lib/format";
import { WEEKDAY_SHORT } from "../lib/labels";

type View = "week" | "month";

/** Monday on or before the date */
const mondayOf = (iso: string) => addDaysIso(iso, -((toDate(iso).getDay() + 6) % 7));

/** The visible day range: the week, or whole weeks covering the month */
function rangeOf(view: View, anchor: string): { from: string; to: string } {
  if (view === "week") {
    const from = mondayOf(anchor);
    return { from, to: addDaysIso(from, 6) };
  }
  const first = `${anchor.slice(0, 7)}-01`;
  const last = addDaysIso(`${addDaysIso(first, 31).slice(0, 7)}-01`, -1);
  return { from: mondayOf(first), to: addDaysIso(mondayOf(last), 6) };
}

function Cell({ c, selected, dim, onPick }: { c: CalendarDay; selected: boolean; dim: boolean; onPick: () => void }) {
  const open = c.tasks.filter((t) => !t.done_at).length;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${fmtDayLong(c.date)}, hedef ${pct(c.ratio)}, ${c.tasks.length} görev`}
      onClick={onPick}
      className={`flex min-h-cell-min flex-col gap-2 rounded-inner border p-4 text-left transition-colors dur-hover ${
        selected ? "border-accent-soft-border bg-accent-soft-bg" : "border-border-subtle bg-surface-1 hover:border-border-strong"
      } ${dim ? "opacity-50" : ""}`}
    >
      <span className={`text-base-sm font-medium ${c.date === todayIso() ? "text-accent-text" : ""}`}>{Number(c.date.slice(8))}</span>
      {c.ratio !== null ? (
        <span className="flex flex-col gap-1">
          <span className="track"><i className={`grow-x ${c.ratio >= 1 ? "bg-success" : "bg-entity-payment"}`} style={{ width: `${Math.min(100, c.ratio * 100)}%` }} /></span>
          <span className="text-xs text-text-secondary">{pct(c.ratio)}</span>
        </span>
      ) : null}
      {c.tasks.length ? <span className={`text-xs ${open ? "text-text-secondary" : "text-text-disabled"}`}>{open ? `${open} görev` : "görevler bitti"}</span> : null}
    </button>
  );
}

export default function Calendar() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(todayIso());
  const [picked, setPicked] = useState(todayIso());
  const { from, to } = rangeOf(view, anchor);
  const cal = useQuery<CalendarDay[]>(`/calendar?from=${from}&to=${to}`);
  const plan = useQuery<Plan>(`/plan?date=${picked}`);
  const step = (dir: 1 | -1) => setAnchor(view === "week" ? addDaysIso(anchor, dir * 7) : addDaysIso(`${anchor.slice(0, 7)}-15`, dir * 30));
  const title = view === "week" ? `${fmtDayLong(from)} – ${fmtDayLong(to)}` : fmtMonth(anchor.slice(0, 7));

  return (
    <Page title="Takvim" sub="Hedef doluluğu ve görevler gün gün" className="flex flex-col gap-7 desk:gap-9">
      <section className="card rise overflow-hidden" aria-label="Takvim">
        <CardHead title={title}>
          <span className="flex items-center gap-3">
            {(["week", "month"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} className="fchip h-control-height-xs" onClick={() => setView(v)}>{v === "week" ? "Hafta" : "Ay"}</button>
            ))}
            <button type="button" className="ibtn" aria-label="Önceki" onClick={() => step(-1)}><Icon name="arrow" className="size-icon-lg rotate-180" /></button>
            <button type="button" className="btn btn-sec btn-sm" onClick={() => { setAnchor(todayIso()); setPicked(todayIso()); }}>Bugün</button>
            <button type="button" className="ibtn" aria-label="Sonraki" onClick={() => step(1)}><Icon name="arrow" className="size-icon-lg" /></button>
          </span>
        </CardHead>
        <div className="grid grid-cols-7 gap-2 px-4 pt-3 text-center text-xs text-text-muted">
          {WEEKDAY_SHORT.map((d) => <span key={d}>{d}</span>)}
        </div>
        {cal.error && !cal.data ? <ErrorBox error={cal.error} retry={cal.reload} /> : null}
        {!cal.data ? (
          !cal.error && <PageSkeleton />
        ) : (
          <div className="grid grid-cols-7 gap-2 p-4">
            {cal.data.map((c) => (
              <Cell key={c.date} c={c} selected={c.date === picked} dim={view === "month" && c.date.slice(0, 7) !== anchor.slice(0, 7)} onPick={() => setPicked(c.date)} />
            ))}
          </div>
        )}
      </section>
      {plan.data ? <DayPlan plan={plan.data} title={fmtDayLong(picked)} /> : null}
    </Page>
  );
}
