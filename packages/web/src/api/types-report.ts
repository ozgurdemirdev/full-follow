// Report, marketing funnel and weekly review shapes (split out of types.ts to stay under 700 lines)
import type { PriceFloor, TemplateGroup } from "./types";

export interface MonthReport {
  month: string;
  collected: number;
  outstanding_due: number;
  floor: number;
  floor_detail: PriceFloor;
  gap: number;
  /** one sentence about the month from the server; null for a coming month and while no floor is set */
  insight: string | null;
  /** opportunities lost in the month; null when the pipeline module is not installed */
  lost: { count: number; budget: number } | null;
}
export interface SourceReport {
  source_id: number;
  source: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  won_value: number;
  conversion: number | null;
}
export interface MarketingReport {
  template_groups: TemplateGroup[];
}
/** Lead source funnel: found, written, replied, meeting, offer, won; rate = against the previous step */
export interface FunnelStep {
  key: string;
  count: number;
  rate: number | null;
}
export interface SourceFunnelRow {
  source_id: number;
  source: string;
  steps: FunnelStep[];
  reply_rate: number | null;
  /** too few written messages for the reply rate to mean much */
  early: boolean;
  weak: boolean;
}
export interface SourceFunnel {
  period: number | "all";
  since: string | null;
  sources: SourceFunnelRow[];
}
/** Weekly review (Friday summary) */
export interface ReviewWeek {
  sent: number;
  replies: number;
  meetings: number;
  reply_rate: number | null;
  new_people: number;
  new_companies: number;
  /** offers made that week */
  offers: number;
}
export interface ReviewPick {
  name: string;
  reply_rate: number | null;
}
export interface ReviewTemplate {
  kind: string;
  channel: string | null;
  leader: ReviewPick | null;
  loser: ReviewPick | null;
  /** templates with too few sends to rank */
  early: number;
}
export interface ReviewSuggestion {
  key: string;
  text: string;
  task_title: string;
}
export interface WeeklyReview {
  week: string;
  start: string;
  end: string;
  current: boolean;
  prev_week: string;
  next_week: string | null;
  /** weekly outgoing message target, 0 = off */
  target: number;
  this_week: ReviewWeek;
  last_week: ReviewWeek;
  templates: ReviewTemplate[];
  sources: { period: number | "all"; best: { source: string; reply_rate: number | null } | null; weakest: { source: string; reply_rate: number | null } | null };
  quota: { channel: string; limit: number; over_days: number; max_sent: number }[];
  suggestions: ReviewSuggestion[];
  /** due date of the tasks made from suggestions */
  next_monday: string;
}
export interface Report {
  sources: SourceReport[];
  month: MonthReport;
}
