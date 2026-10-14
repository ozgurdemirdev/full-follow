import type { FollowupDue, QuotaOverDays } from "./drafts";
import type { IdeaStats } from "./ideas";
import type { WeekStats } from "./network";
import type { SourceConversion, SourceFunnel } from "./pipeline";
import type { PostStats } from "./posts";
import type { TemplateGroup } from "./templates";

/** The monthly price floor with what it is made of: the settings numbers (and the other settings the view carries) */
export interface PriceFloor {
  bagkur_monthly: number;
  accounting_monthly: number;
  other_fixed_monthly: number;
  target_net_monthly: number;
  tax_rate_percent: number;
  subtotal: number;
  floor: number;
  [setting: string]: unknown;
}

/**
 * One month: what was collected (zero without the projects module), what is still due in it, the floor and the gap to it,
 * one Turkish sentence about it (null for a coming month and while no floor is set) and what was lost in it (null without the pipeline module)
 */
export interface MonthReport {
  month: string;
  collected: number;
  outstanding_due: number;
  floor: number;
  floor_detail: PriceFloor;
  gap: number;
  insight: string | null;
  /** opportunities lost in the month: how many and the sum of their estimated values */
  lost: { count: number; budget: number } | null;
}

/** Outgoing people of a channel over the last days, how many of them answered */
export interface ChannelPerformance {
  channel: string;
  people: number;
  replied: number;
  sent: number;
  reply_rate: number | null;
}

/** The marketing part of the report: each list comes from its module and is empty without it */
export interface MarketingReport {
  posts: PostStats[];
  posts_due: PostStats[];
  ideas: IdeaStats[];
  template_groups: TemplateGroup[];
  channels: ChannelPerformance[];
  followups: FollowupDue[];
}

/** A plain suggestion for next week; `task_title` is the title of the task "Göreve çevir" creates */
export interface ReviewSuggestion {
  key: string;
  text: string;
  task_title: string;
}

interface ReviewTemplateGroup {
  kind: string;
  channel: string | null;
  leader: { name: string; reply_rate: number | null } | null;
  loser: { name: string; reply_rate: number | null } | null;
  early: number;
}

/** The weekly review (Friday summary) of one ISO week */
export interface WeeklyReview {
  week: string;
  start: string;
  end: string;
  current: boolean;
  prev_week: string;
  next_week: string | null;
  target: number;
  this_week: WeekStats["this_week"] & { offers: number };
  last_week: WeekStats["last_week"] & { offers: number };
  by_channel: WeekStats["by_channel"];
  templates: ReviewTemplateGroup[];
  sources: { period: SourceFunnel["period"]; best: { source: string; reply_rate: number | null } | null; weakest: { source: string; reply_rate: number | null } | null };
  quota: QuotaOverDays[];
  suggestions: ReviewSuggestion[];
  /** the date "Göreve çevir" tasks are due: the Monday after today */
  next_monday: string;
}

/**
 * Public API of the reports module (`ctx.mod("reports")`): the month report against the price floor, the weekly review and the marketing report.
 * Money and activity numbers come from the projects, pipeline, network, drafts, templates, posts and ideas modules; a missing module leaves its part empty.
 */
export interface ReportsApi {
  /** (Bağkur + accounting + other fixed + target net) / (1 - tax rate) */
  priceFloor(): PriceFloor;
  /** lead source conversion (empty without the pipeline module) */
  bySource(): SourceConversion[];
  sourceFunnel(period?: unknown): SourceFunnel | undefined;
  month(ym?: string): MonthReport;
  /** the last `count` months, oldest first (for the chart) */
  months(count?: number, until?: string): MonthReport[];
  report(ym?: string): { sources: SourceConversion[]; month: MonthReport };
  marketing(): MarketingReport;
  review(week?: string): WeeklyReview;
}
