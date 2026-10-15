// Dashboard: how many rows each card shows and the thresholds behind its colours and words
import type { Payment } from "../api/types";
import { daysFrom } from "./format";

export const SHOWN = { drafts: 2, awaiting: 4, cooling: 3, comments: 3, payments: 3, projects: 3, followups: 5, posts: 4 } as const;
/** A payment due within this many days counts as "Bu hafta" */
export const PAYMENT_SOON_DAYS = 7;
/** A client project whose next date is within this many days gets the warning colour */
export const PROJECT_SOON_DAYS = 7;
/** Client project stages still being worked on (the rest are delivered, in maintenance or cancelled) */
export const ACTIVE_PROJECT_STAGES = ["pesinat", "tasarim_onayi", "test_surumu", "yayin"];

export type PaymentGroup = "late" | "soon" | "later";
export const PAYMENT_GROUPS: { key: PaymentGroup; label: string; dot: string; bg: string }[] = [
  { key: "late", label: "Gecikmiş", dot: "bg-danger", bg: "bg-danger" },
  { key: "soon", label: "Bu hafta", dot: "bg-accent", bg: "bg-accent" },
  { key: "later", label: "Sonra", dot: "bg-entity-later", bg: "bg-entity-later" },
];

export const remaining = (p: Payment) => p.expected_amount - p.paid_amount;

export function paymentGroup(p: Payment, today: string): PaymentGroup {
  if (p.status === "gecikmis" || (p.due_date && p.due_date < today)) return "late";
  return p.due_date && daysFrom(p.due_date, today) <= PAYMENT_SOON_DAYS ? "soon" : "later";
}

/** Days a payment is past its due date (0 when it is not) */
export const lateDays = (p: Payment, today: string) => (p.due_date ? Math.max(0, -daysFrom(p.due_date, today)) : 0);
