import { addDays, daysBetween, FFError, isIsoDate, isoWeekOf, isoWeekStart, label, marketingSettings, SOURCE_FUNNEL_DEFAULT_PERIOD, weekStart, type Ctx, type ReviewSuggestion, type WeekStats, type WeeklyReview } from "@fullfollow/core";
import { REVIEW_LIMIT_DAYS, REVIEW_MAX_SUGGESTIONS, REVIEW_MIN_SUGGESTIONS, REVIEW_TARGET_MISS_SHARE, REVIEW_TARGET_STEP, REVIEW_WEEKDAY, WEEK_DAYS } from "../constants";
import { m } from "../messages";

const pct = (r: number | null | undefined) => `%${Math.round((r ?? 0) * 100)}`;

/** Monday of the asked week: an ISO week label ("2026-W41"), any date in it, or the current week when empty */
function weekStartOf(ctx: Ctx, week?: string): string {
  if (!week) return weekStart(ctx.clock.today());
  const monday = isIsoDate(week) ? weekStart(week) : isoWeekStart(week);
  if (!monday) throw new FFError("validation", m.badWeek);
  return monday;
}

/** Template groups that have a clear leader or early (small sample) templates; the loser is the weakest template with enough sample (none without the templates module) */
function templateHighlights(ctx: Ctx) {
  return (ctx.mod("templates")?.comparison() ?? []).flatMap((g) => {
    const leader = g.templates.find((t) => t.leader);
    const settled = g.templates.filter((t) => !t.early);
    const early = g.templates.length - settled.length;
    if (!leader && !early) return [];
    const pick = (t: (typeof g.templates)[number]) => ({ name: t.name, reply_rate: t.reply_rate });
    return [{ kind: g.kind, channel: g.channel, leader: leader ? pick(leader) : null, loser: leader ? pick(settled[settled.length - 1]) : null, early }];
  });
}

/** Best and weakest source of the default funnel period (best only among sources with enough sample); empty without the pipeline module */
function sourceHighlights(ctx: Ctx) {
  const f = ctx.mod("pipeline")?.funnel() ?? { period: SOURCE_FUNNEL_DEFAULT_PERIOD, sources: [] };
  const settled = f.sources.filter((s) => !s.early).sort((a, b) => b.reply_rate! - a.reply_rate!);
  const weak = settled.filter((s) => s.weak).at(-1);
  const pick = (s?: (typeof settled)[number]) => (s ? { source: s.source, reply_rate: s.reply_rate } : null);
  return { period: f.period, best: pick(settled[0]), weakest: pick(weak) };
}

/** The week's touch numbers; zero when the network module is not installed */
const NO_WEEK: WeekStats = {
  week_start: "",
  this_week: { sent: 0, replies: 0, meetings: 0, reply_rate: null, new_people: 0, new_companies: 0 },
  last_week: { sent: 0, replies: 0, meetings: 0, reply_rate: null, new_people: 0, new_companies: 0 },
  by_channel: [], open_offers: 0, silent_offers: 0,
};

type Facts = ReturnType<typeof buildFacts>;

/** Facts the suggestions are built from */
function buildFacts(ctx: Ctx, ws: string) {
  const w = ctx.mod("network")?.weekStats(ws) ?? { ...NO_WEEK, week_start: ws };
  const until = addDays(ws, WEEK_DAYS - 1);
  const prev = addDays(ws, -WEEK_DAYS);
  return {
    stats: w,
    /** days of the week already lived: 7 for a finished week */
    days: Math.min(WEEK_DAYS, daysBetween(ws, ctx.clock.today()) + 1),
    target: marketingSettings(ctx).weekly_target,
    offers: { this_week: ctx.mod("pipeline")?.offersMade(ws, until) ?? 0, last_week: ctx.mod("pipeline")?.offersMade(prev, addDays(ws, -1)) ?? 0 },
    templates: templateHighlights(ctx),
    sources: sourceHighlights(ctx),
    quota: ctx.mod("drafts")?.quotaOverDays(ws, until) ?? [],
  };
}

/**
 * 2 to 4 plain suggestions for next week, rule based (no AI): a missed weekly target, a template group with a clear leader,
 * a weak lead source, a channel that is full most days; unconditional ones fill up to the minimum.
 */
function suggestions(f: Facts): ReviewSuggestion[] {
  const out: ReviewSuggestion[] = [];
  const sent = f.stats.this_week.sent;
  // An unfinished week is judged from Friday on, by the pace it would end the week with
  const pace = Math.round((sent * WEEK_DAYS) / f.days);
  if (f.target && f.days >= REVIEW_WEEKDAY && pace < f.target * REVIEW_TARGET_MISS_SHARE) {
    const rounded = Math.ceil(pace / REVIEW_TARGET_STEP) * REVIEW_TARGET_STEP;
    const lowered = pace > 0 && rounded < f.target ? rounded : undefined;
    out.push({
      key: "target",
      text: m.suggestion.target(f.target, f.days < WEEK_DAYS, pace, sent, lowered),
      task_title: m.suggestion.targetTask(f.target, sent),
    });
  }
  const group = f.templates.filter((g) => g.leader && g.loser).sort((a, b) => (b.leader!.reply_rate! - b.loser!.reply_rate!) - (a.leader!.reply_rate! - a.loser!.reply_rate!))[0];
  if (group) {
    out.push({
      key: "template",
      text: m.suggestion.template(label(group.kind), group.channel ? label(group.channel) : null, group.loser!.name, group.leader!.name, pct(group.leader!.reply_rate), pct(group.loser!.reply_rate)),
      task_title: m.suggestion.templateTask(group.loser!.name, group.leader!.name),
    });
  }
  const { best, weakest } = f.sources;
  if (best && weakest) {
    out.push({
      key: "source",
      text: m.suggestion.source(weakest.source, pct(weakest.reply_rate), best.source, pct(best.reply_rate)),
      task_title: m.suggestion.sourceTask(weakest.source, best.source),
    });
  }
  const full = f.quota.filter((c) => c.over_days >= REVIEW_LIMIT_DAYS).sort((a, b) => b.over_days - a.over_days)[0];
  if (full) {
    out.push({
      key: "quota",
      text: m.suggestion.quota(label(full.channel), full.over_days),
      task_title: m.suggestion.quotaTask(label(full.channel), full.limit),
    });
  }
  const added = f.stats.this_week.new_people + f.stats.this_week.new_companies;
  const fillers: ReviewSuggestion[] = [
    ...(!f.target
      ? [{ key: "target_set", text: m.suggestion.targetSet, task_title: m.suggestion.targetSetTask }]
      : sent >= f.target ? [{ key: "target_met", text: m.suggestion.targetMet(f.target, sent), task_title: m.suggestion.targetMetTask }] : []),
    { key: "records", text: m.suggestion.records(added), task_title: m.suggestion.recordsTask },
    { key: "data", text: m.suggestion.data, task_title: m.suggestion.dataTask },
  ];
  for (const s of fillers) if (out.length < REVIEW_MIN_SUGGESTIONS && !out.some((o) => o.key === s.key)) out.push(s);
  return out.slice(0, REVIEW_MAX_SUGGESTIONS);
}

/**
 * Weekly review (Friday summary) of one ISO week: messages against the weekly target, reply rate against the week before,
 * meetings, offers, new records, template and source highlights, daily limit overruns and suggestions for next week.
 * Everything is computed from existing services; nothing is stored.
 */
export function weeklyReview(ctx: Ctx, week?: string): WeeklyReview {
  const ws = weekStartOf(ctx, week);
  const f = buildFacts(ctx, ws);
  const currentStart = weekStart(ctx.clock.today());
  const { this_week, last_week, by_channel } = f.stats;
  return {
    week: isoWeekOf(ws), start: ws, end: addDays(ws, WEEK_DAYS - 1), current: ws === currentStart,
    prev_week: isoWeekOf(addDays(ws, -WEEK_DAYS)), next_week: ws < currentStart ? isoWeekOf(addDays(ws, WEEK_DAYS)) : null,
    target: f.target,
    this_week: { ...this_week, offers: f.offers.this_week }, last_week: { ...last_week, offers: f.offers.last_week },
    by_channel, templates: f.templates, sources: f.sources, quota: f.quota,
    suggestions: suggestions(f),
    /** "Göreve çevir" tasks are due on the Monday after today */
    next_monday: addDays(currentStart, WEEK_DAYS),
  };
}
