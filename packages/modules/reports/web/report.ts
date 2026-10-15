// Report screen: floor maths, chart scale, expected payments
import type { MonthReport, Payment, PriceFloor, SourceReport } from "@kit/api/types";
import { daysFrom, fmtDay, fmtMonth, lira, toDate } from "@kit/lib/format";
import { LOCALE } from "@kit/lib/i18n";
import { MILESTONE } from "@kit/lib/labels";
import { PAYMENT_SOON_DAYS, paymentGroup, remaining, type PaymentGroup } from "@kit/lib/dashboard";
import { PERCENT, THOUSAND } from "./constants";
import { m } from "./messages";

/** Months in the bar chart (the current month is the last bar) */
export const REPORT_MONTHS = 6;
/** Bars and the hero meter leave this much room above the tallest value so the floor line never sits at the top edge */
export const SCALE_HEADROOM = 1.12;
/** The cost inputs are saved this long after the last keystroke */
export const SAVE_DELAY_MS = 700;
/** Highest tax rate the report accepts (percent) */
export const TAX_MAX_PERCENT = 60;

export const COST_FIELDS = [
  { key: "bagkur_monthly", label: m.costs.bagkur, prefix: m.shared.currency, dot: "bg-info" },
  { key: "accounting_monthly", label: m.costs.accounting, prefix: m.shared.currency, dot: "bg-entity-source" },
  { key: "other_fixed_monthly", label: m.costs.otherFixed, prefix: m.shared.currency, dot: "bg-entity-comment" },
  { key: "target_net_monthly", label: m.costs.targetNet, prefix: m.shared.currency, dot: "bg-accent" },
  { key: "tax_rate_percent", label: m.costs.taxRate, prefix: m.shared.percent, dot: "bg-warning" },
] as const;
export type CostKey = (typeof COST_FIELDS)[number]["key"];
export type Costs = Pick<PriceFloor, CostKey>;

/** Same rule as the core: (sum of costs and target net) divided by what is left after tax, rounded up */
export function floorOf(c: Costs) {
  const subtotal = c.bagkur_monthly + c.accounting_monthly + c.other_fixed_monthly + c.target_net_monthly;
  const rate = Math.min(TAX_MAX_PERCENT, Math.max(0, c.tax_rate_percent)) / PERCENT;
  return { subtotal, floor: Math.ceil(subtotal / (1 - rate)) };
}

/** The stacked bar under the cost inputs: each part's share of the floor, tax is what the floor adds to the subtotal */
export function stackOf(c: Costs) {
  const { subtotal, floor } = floorOf(c);
  const share = (v: number) => (floor > 0 ? (v / floor) * PERCENT : 0);
  return COST_FIELDS.map((f) => ({
    key: f.key,
    label: f.label,
    dot: f.dot,
    width: share(f.key === "tax_rate_percent" ? floor - subtotal : c[f.key]),
  }));
}

/** "Son 5 ayın 3’ü tabanın üstünde" needs the Turkish possessive of the number */
export const possessive = m.possessive;

export const monthName = (ym: string) => fmtMonth(ym).split(" ")[0];
/** "₺52B" for 52.000 */
export const shortLira = (n: number) => m.shortLira((n / THOUSAND).toLocaleString(LOCALE, { maximumFractionDigits: 1 }));

export interface Incoming {
  id: number;
  projectId: number;
  name: string;
  group: PaymentGroup;
  when: string;
  amount: number;
}

const weekday = new Intl.DateTimeFormat(LOCALE, { weekday: "long" });
/** Colour classes of an expected payment: its dot and its date text */
export const INCOMING_COLOR: Record<PaymentGroup, { dot: string; text: string }> = {
  late: { dot: "bg-danger", text: "text-danger" },
  soon: { dot: "bg-warning", text: "text-warning" },
  later: { dot: "bg-info", text: "text-info" },
};

function whenText(p: Payment, today: string): string {
  const d = daysFrom(p.due_date!, today);
  if (d < 0) return m.when.late(-d);
  if (d === 0) return m.when.today;
  return d <= PAYMENT_SOON_DAYS ? weekday.format(toDate(p.due_date!)).toLocaleLowerCase(LOCALE) : fmtDay(p.due_date);
}

/** Unpaid payments that are due this month or are already late, oldest due date first (what "bu ay gelmesi beklenen" means) */
export function incomingOf(payments: Payment[], today: string): Incoming[] {
  const ym = today.slice(0, 7);
  return payments
    .filter((p) => p.due_date && p.due_date.slice(0, 7) <= ym && remaining(p) > 0)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || a.id - b.id)
    .map((p) => ({
      id: p.id,
      projectId: p.project_id,
      name: `${p.project_name} ${(MILESTONE[p.milestone] ?? p.milestone).toLocaleLowerCase(LOCALE)}`,
      group: paymentGroup(p, today),
      when: whenText(p, today),
      amount: remaining(p),
    }));
}

export interface Expected {
  count: number;
  total: number;
  lateCount: number;
  lateTotal: number;
}
export function expectedOf(list: Incoming[]): Expected {
  const late = list.filter((x) => x.group === "late");
  return {
    count: list.length,
    total: list.reduce((a, x) => a + x.amount, 0),
    lateCount: late.length,
    lateTotal: late.reduce((a, x) => a + x.amount, 0),
  };
}

export interface Hero {
  /** "Ekim (13 gün geçti)" */
  label: string;
  collected: number;
  floor: number;
  /** floor minus collected: positive means still short */
  gap: number;
  /** percent of the meter, all on the same scale (the floor marker sits at floorX) */
  fill: number;
  pending: number;
  floorX: number;
  /** pending lira (only the current month has any) */
  pendingAmount: number;
}

/** Everything is measured against the tallest bar (or the floor) plus the headroom, so the hero meter and the bars share one scale */
export function scaleTop(months: MonthReport[], floor: number, pendingNow: number, now: string): number {
  const tallest = Math.max(floor, ...months.map((m) => m.collected + (m.month === now ? pendingNow : 0)));
  return tallest * SCALE_HEADROOM || 1;
}

export function heroOf(month: MonthReport, floor: number, pendingNow: number, top: number, today: string): Hero {
  const now = month.month === today.slice(0, 7);
  const pendingAmount = now ? pendingNow : 0;
  const fill = Math.min(PERCENT, (month.collected / top) * PERCENT);
  return {
    label: `${monthName(month.month)}${now ? m.hero.daysPassed(Number(today.slice(8, 10))) : ""}`,
    collected: month.collected,
    floor,
    gap: floor - month.collected,
    fill,
    pending: Math.min(PERCENT - fill, (pendingAmount / top) * PERCENT),
    floorX: (floor / top) * PERCENT,
    pendingAmount,
  };
}

/** Hint line under the floor: what the floor means in average won projects (only when won opportunities have a value and the floor is at least one such project) */
export function floorHint(floor: number, sources: SourceReport[]): string | null {
  const won = sources.reduce((a, s) => a + s.won, 0);
  const value = sources.reduce((a, s) => a + s.won_value, 0);
  if (!won || !value || !floor) return null;
  const avg = value / won;
  if (floor < avg) return null;
  return m.floorHint((floor / avg).toLocaleString(LOCALE, { maximumFractionDigits: 1 }), lira(Math.round(avg)));
}

/** How many of the earlier months reached the floor */
export const monthsAbove = (months: MonthReport[], floor: number, now: string) => months.filter((m) => m.month !== now && m.collected >= floor).length;
