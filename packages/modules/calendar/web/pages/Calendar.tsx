import { useMemo, useState } from "react";
import { useQuery } from "@kit/api/store";
import type { CalendarDay } from "../types";
import { Page } from "@kit/app/Page";
import { BoardIcon } from "@kit/components/boardIcons";
import { MonthGrid } from "../components/MonthGrid";
import { DayPanel } from "../components/DayPanel";
import { EndOfDay, WeeklyGoals, type WeekGoal } from "../components/SideCards";
import { KindPills, WeekSummary, type WeekStats } from "../components/Summary";
import { useDay } from "../components/useDay";
import { WeekList } from "../components/WeekList";
import { ErrorBox, Filters, PageSkeleton } from "@kit/components/ui";
import { dayTitle, GOAL_BEHIND, isoWeek, itemsByDate, KINDS, mondayOf, rangeOf, type Kind, type View } from "../calendar";
import { addDaysIso, fmtDay, fmtMonth, todayIso, toDate } from "@kit/lib/format";

const DAYS_IN_WEEK = 7;
const VIEWS: { value: View; label: string }[] = [{ value: "week", label: "Hafta" }, { value: "month", label: "Ay" }];
const monthName = new Intl.DateTimeFormat("tr-TR", { month: "long" });

const datesOf = (from: string, to: string) => {
  const list: string[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) list.push(d);
  return list;
};

/** "12 – 18 Ekim 2026 · 42. hafta" (both months when the week crosses one) */
function weekLabel(from: string, to: string) {
  const a = toDate(from);
  const b = toDate(to);
  const first = a.getMonth() === b.getMonth() ? `${a.getDate()}` : `${a.getDate()} ${monthName.format(a)}`;
  return `${first} – ${b.getDate()} ${monthName.format(b)} ${b.getFullYear()} · ${isoWeek(from)}. hafta`;
}

/** Weekly figures from the feed days of the week: items, goal totals (a day counts up to its target) */
function weekOf(days: CalendarDay[]) {
  const goals = new Map<number, WeekGoal>();
  for (const d of days) {
    for (const g of d.goals) {
      const cur = goals.get(g.id) ?? { id: g.id, title: g.title, done: 0, target: 0 };
      goals.set(g.id, { ...cur, done: cur.done + Math.min(g.done, g.target), target: cur.target + g.target });
    }
  }
  return [...goals.values()];
}

export default function Calendar() {
  const today = todayIso();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(today);
  const [picked, setPicked] = useState(today);
  const [hidden, setHidden] = useState<ReadonlySet<Kind>>(new Set());
  const { from, to } = rangeOf(view, anchor);
  const cal = useQuery<CalendarDay[]>(`/calendar?from=${from}&to=${to}`);
  const feed = { from, to, days: cal.data };
  const day = useDay(picked, feed);
  const now = useDay(today, feed);

  const byDate = useMemo(() => itemsByDate(cal.data ?? [], today), [cal.data, today]);
  const weekStart = mondayOf(picked);
  const weekDates = datesOf(weekStart, addDaysIso(weekStart, DAYS_IN_WEEK - 1));
  const weekItems = weekDates.flatMap((d) => byDate.get(d) ?? []);
  const goals = weekOf((cal.data ?? []).filter((d) => weekDates.includes(d.date)));
  const target = goals.reduce((s, g) => s + g.target, 0);
  const filled = goals.reduce((s, g) => s + g.done, 0);
  const behind = goals.filter((g) => g.done / g.target < GOAL_BEHIND).sort((a, b) => a.done / a.target - b.done / b.target)[0] ?? null;
  const stats: WeekStats = {
    done: weekItems.filter((e) => e.done).length,
    total: weekItems.length,
    left: (now.items ?? []).filter((e) => !e.done).length,
    goalFill: target ? filled / target : null,
    behind,
  };
  const counts = Object.fromEntries(KINDS.map((k) => [k.key, weekItems.filter((e) => e.kind === k.key).length])) as Record<Kind, number>;

  const toggle = (k: Kind) => setHidden((cur) => { const next = new Set(cur); if (!next.delete(k)) next.add(k); return next; });
  const goToday = () => { setView("week"); setAnchor(today); setPicked(today); };
  const step = (dir: 1 | -1) => {
    const next = view === "week" ? addDaysIso(anchor, dir * DAYS_IN_WEEK) : addDaysIso(`${anchor.slice(0, 7)}-15`, dir * 30);
    const range = rangeOf(view, next);
    setAnchor(next);
    setPicked(today >= range.from && today <= range.to && (view === "week" || today.slice(0, 7) === next.slice(0, 7)) ? today : view === "week" ? addDaysIso(picked, dir * DAYS_IN_WEEK) : `${next.slice(0, 7)}-01`);
  };
  /** A day of the week of today opens the week view, as on the board */
  const pick = (date: string) => {
    setPicked(date);
    if (view === "month" && mondayOf(date) === mondayOf(today)) { setView("week"); setAnchor(date); }
  };
  const sub = view === "week" ? weekLabel(from, to) : fmtMonth(anchor.slice(0, 7));

  return (
    <Page title="Takvim" sub={sub} gap="tight" className="flex flex-col gap-9"
      right={
        <div className="cal-tools">
          <Filters label="Görünüm" size="md" items={VIEWS} value={view} onChange={setView} />
          <button type="button" className="cal-nav" aria-label="Önceki" onClick={() => step(-1)}><BoardIcon name="chevronLeft" className="size-icon-md" stroke={2} /></button>
          <button type="button" className="cal-today" onClick={goToday}>Bugün</button>
          <button type="button" className="cal-nav" aria-label="Sonraki" onClick={() => step(1)}><BoardIcon name="chevronRight" className="size-icon-md" stroke={2} /></button>
        </div>
      }>
      {cal.error && !cal.data ? <ErrorBox error={cal.error} retry={cal.reload} /> : null}
      {!cal.data ? (
        !cal.error && <PageSkeleton />
      ) : (
        <>
          <WeekSummary s={stats} />
          <KindPills counts={counts} hidden={hidden} onToggle={toggle} />
          {view === "week"
            ? <WeekList dates={datesOf(from, to)} items={byDate} hidden={hidden} picked={picked} today={today} onPick={pick} />
            : <MonthGrid dates={datesOf(from, to)} month={anchor.slice(0, 7)} items={byDate} hidden={hidden} picked={picked} today={today} onPick={pick} />}
          <div className="cal-below">
            {day.items ? <DayPanel title={dayTitle(picked, today)} date={picked} items={day.items} hidden={hidden} /> : null}
            <div className="flex min-w-0 flex-col gap-9">
              <EndOfDay items={now.items ?? []} />
              <WeeklyGoals goals={goals} dayGoals={day.plan?.goals ?? []} date={picked} dayLabel={fmtDay(picked)} streak={now.plan?.streak ?? 0} />
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
