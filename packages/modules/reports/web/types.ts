// Report and weekly review shapes

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
