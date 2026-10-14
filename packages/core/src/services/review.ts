import { label, REVIEW_LIMIT_DAYS, REVIEW_MAX_SUGGESTIONS, REVIEW_MIN_SUGGESTIONS, REVIEW_TARGET_MISS_SHARE, REVIEW_TARGET_STEP, REVIEW_WEEKDAY, SOURCE_FUNNEL_DEFAULT_PERIOD, WEEK_DAYS } from "../constants";
import { addDays, daysBetween, isIsoDate, isoWeekOf, isoWeekStart, weekStart } from "../dates";
import { FFError, type Ctx } from "../context";
import type { WeekStats } from "../contracts";
import { quotaOverDays } from "./quota";
import { marketingSettings } from "./settings";
import { templateComparison } from "./templates";

export interface Suggestion {
  key: string;
  text: string;
  /** title of the task "Göreve çevir" creates */
  task_title: string;
}

const pct = (r: number | null | undefined) => `%${Math.round((r ?? 0) * 100)}`;

/** Monday of the asked week: an ISO week label ("2026-W41"), any date in it, or the current week when empty */
function weekStartOf(ctx: Ctx, week?: string): string {
  if (!week) return weekStart(ctx.clock.today());
  const monday = isIsoDate(week) ? weekStart(week) : isoWeekStart(week);
  if (!monday) throw new FFError("validation", "hafta YYYY-Www (örn. 2026-W41) ya da bir tarih olmalı");
  return monday;
}

/** Template groups that have a clear leader or early (small sample) templates; the loser is the weakest template with enough sample */
function templateHighlights(ctx: Ctx) {
  return templateComparison(ctx).flatMap((g) => {
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
  const until = addDays(ws, 6);
  const prev = addDays(ws, -7);
  return {
    stats: w,
    /** days of the week already lived: 7 for a finished week */
    days: Math.min(WEEK_DAYS, daysBetween(ws, ctx.clock.today()) + 1),
    target: marketingSettings(ctx).weekly_target,
    offers: { this_week: ctx.mod("pipeline")?.offersMade(ws, until) ?? 0, last_week: ctx.mod("pipeline")?.offersMade(prev, addDays(ws, -1)) ?? 0 },
    templates: templateHighlights(ctx),
    sources: sourceHighlights(ctx),
    quota: quotaOverDays(ctx, ws, until),
  };
}

/**
 * 2 to 4 plain suggestions for next week, rule based (no AI): a missed weekly target, a template group with a clear leader,
 * a weak lead source, a channel that is full most days; unconditional ones fill up to the minimum.
 */
function suggestions(f: Facts): Suggestion[] {
  const out: Suggestion[] = [];
  const sent = f.stats.this_week.sent;
  // An unfinished week is judged from Friday on, by the pace it would end the week with
  const pace = Math.round((sent * WEEK_DAYS) / f.days);
  if (f.target && f.days >= REVIEW_WEEKDAY && pace < f.target * REVIEW_TARGET_MISS_SHARE) {
    const rounded = Math.ceil(pace / REVIEW_TARGET_STEP) * REVIEW_TARGET_STEP;
    const lower = pace > 0 && rounded < f.target ? `hedefi ${rounded} yap ya da ` : "";
    out.push({
      key: "target",
      text: `Haftalık hedef ${f.target}, ${f.days < WEEK_DAYS ? `bu tempoyla ${pace}` : `giden ${sent}`}: ${lower}her güne ayrı bir giden mesaj hedefi ekle.`,
      task_title: `Haftalık hedefi gözden geçir (${f.target}, bu hafta ${sent})`,
    });
  }
  const group = f.templates.filter((g) => g.leader && g.loser).sort((a, b) => (b.leader!.reply_rate! - b.loser!.reply_rate!) - (a.leader!.reply_rate! - a.loser!.reply_rate!))[0];
  if (group) {
    out.push({
      key: "template",
      text: `${label(group.kind)} / ${group.channel ? label(group.channel) : "tüm kanallar"}: "${group.loser!.name}" şablonunu bırak, "${group.leader!.name}" önde (${pct(group.leader!.reply_rate)} / ${pct(group.loser!.reply_rate)}).`,
      task_title: `"${group.loser!.name}" şablonunu bırak, "${group.leader!.name}" kullan`,
    });
  }
  const { best, weakest } = f.sources;
  if (best && weakest) {
    out.push({
      key: "source",
      text: `"${weakest.source}" kaynağı zayıf (cevap ${pct(weakest.reply_rate)}): zamanı "${best.source}" kaynağına kaydır (${pct(best.reply_rate)}).`,
      task_title: `Zamanı "${weakest.source}" yerine "${best.source}" kaynağına ayır`,
    });
  }
  const full = f.quota.filter((c) => c.over_days >= REVIEW_LIMIT_DAYS).sort((a, b) => b.over_days - a.over_days)[0];
  if (full) {
    out.push({
      key: "quota",
      text: `${label(full.channel)} günlük limiti bu hafta ${full.over_days} gün doldu: limit işini görüyor, aynı kalsın.`,
      task_title: `${label(full.channel)} günlük limitini koru (${full.limit})`,
    });
  }
  const added = f.stats.this_week.new_people + f.stats.this_week.new_companies;
  const fillers: Suggestion[] = [
    ...(!f.target
      ? [{ key: "target_set", text: "Haftalık giden mesaj hedefi yok: Ayarlar'dan bir hedef koy, haftayı ona göre ölçersin.", task_title: "Haftalık giden mesaj hedefi koy" }]
      : sent >= f.target ? [{ key: "target_met", text: `Haftalık hedef ${f.target}, giden ${sent}: bu tempoyu koru.`, task_title: "Haftalık giden mesaj temposunu koru" }] : []),
    { key: "records", text: added ? `Bu hafta ${added} yeni kayıt eklendi: liste yenilemeyi gelecek hafta da sürdür.` : "Bu hafta yeni kayıt eklenmedi: liste yenileme için gelecek hafta bir gün ayır.", task_title: "Liste yenileme için bir gün ayır" },
    { key: "data", text: "Şablon ve kaynak kıyası için örnek az: mesajlarda şablon seç, kayıtlara kaynak gir.", task_title: "Mesajlarda şablon seç, kayıtlara kaynak gir" },
  ];
  for (const s of fillers) if (out.length < REVIEW_MIN_SUGGESTIONS && !out.some((o) => o.key === s.key)) out.push(s);
  return out.slice(0, REVIEW_MAX_SUGGESTIONS);
}

/**
 * Weekly review (Friday summary) of one ISO week: messages against the weekly target, reply rate against the week before,
 * meetings, offers, new records, template and source highlights, daily limit overruns and suggestions for next week.
 * Everything is computed from existing services; nothing is stored.
 */
export function weeklyReview(ctx: Ctx, week?: string) {
  const ws = weekStartOf(ctx, week);
  const f = buildFacts(ctx, ws);
  const currentStart = weekStart(ctx.clock.today());
  const { this_week, last_week, by_channel } = f.stats;
  return {
    week: isoWeekOf(ws), start: ws, end: addDays(ws, 6), current: ws === currentStart,
    prev_week: isoWeekOf(addDays(ws, -7)), next_week: ws < currentStart ? isoWeekOf(addDays(ws, 7)) : null,
    target: f.target,
    this_week: { ...this_week, offers: f.offers.this_week }, last_week: { ...last_week, offers: f.offers.last_week },
    by_channel, templates: f.templates, sources: f.sources, quota: f.quota,
    suggestions: suggestions(f),
    /** "Göreve çevir" tasks are due on the Monday after today */
    next_monday: addDays(currentStart, 7),
  };
}
